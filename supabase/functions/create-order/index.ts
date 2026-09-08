import { createClient } from "npm:@supabase/supabase-js@2";
import { getOlseraHeaders, isOlseraConfigured } from "../_shared/olsera.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const TIER_DISCOUNTS: Record<string, number> = {
  Classic: 0,
  Bronze: 0.10,
  Silver: 0.15,
  Gold: 0.20,
};

function roundTo100(n: number): number {
  return Math.round(n / 100) * 100;
}

function getDeliveryFee(tableName: string): number {
  if (tableName.startsWith("Mille 1")) return 10000;
  if (tableName.startsWith("Mille 3")) return 12000;
  return 0;
}

function isQrisOnly(tableName: string): boolean {
  return ["Mille 1", "Mille 2", "Mille 3"].some((l) => tableName.startsWith(l));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { items, member_id, table_name, payment_method, phone, voucher_code } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "Cart is empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!table_name) {
      return new Response(JSON.stringify({ error: "Table name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting: max 5 orders per table per 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("table_name", table_name)
      .gte("created_at", tenMinAgo);
    if (count && count >= 5) {
      return new Response(JSON.stringify({ error: "Too many orders from this table. Please wait a few minutes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate payment method for QRIS-only tables
    if (payment_method === "cash" && isQrisOnly(table_name)) {
      return new Response(JSON.stringify({ error: "This table only accepts QRIS payment" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up product prices from DB
    const productIds = items.map((i: any) => i.product_id);
    const { data: products, error: prodError } = await supabase
      .from("products")
      .select("id, name, pos_sell_price, variant_names, pos_hidden")
      .in("id", productIds);

    if (prodError) throw prodError;

    const productMap = new Map((products || []).map((p: any) => [p.id, p]));

    // Compute subtotal from DB prices (never trust client prices)
    let subtotal = 0;
    const validatedItems = items.map((item: any) => {
      const product = productMap.get(item.product_id);
      if (!product) throw new Error(`Product not found: ${item.product_id}`);
      if (product.pos_hidden && !item.is_promo) throw new Error(`Product not available: ${product.name}`);

      const price = item.is_promo ? 0 : product.pos_sell_price;
      subtotal += price * item.quantity;

      return {
        product_id: item.product_id,
        name: product.name,
        variant: item.variant || (product.variant_names[0] ?? "Regular"),
        price,
        quantity: item.quantity,
        is_promo: item.is_promo || false,
        promo_link_id: item.promo_link_id || null,
      };
    });

    // Get member discount if applicable
    let discountRate = 0;
    let isMember = false;
    if (member_id) {
      const { data: member } = await supabase
        .from("members")
        .select("tier, user_id")
        .eq("user_id", member_id)
        .maybeSingle();
      if (member) {
        isMember = true;
        discountRate = TIER_DISCOUNTS[member.tier] || 0;
      }
    }

    const discount = Math.round(subtotal * discountRate);
    const afterDiscount = subtotal - discount;
    const tax = Math.round(afterDiscount * 0.10);
    const deliveryFee = getDeliveryFee(table_name);
    const total = afterDiscount + tax + deliveryFee;
    const grandTotal = roundTo100(total);

    // Handle voucher if provided
    let voucherId: string | null = null;
    let voucherDiscount = 0;
    if (voucher_code) {
      const { data: voucher } = await supabase
        .from("vouchers")
        .select("id, type, value, limit_per_day, active")
        .eq("code", voucher_code)
        .eq("active", true)
        .maybeSingle();

      if (voucher) {
        // Check daily limit
        if (voucher.limit_per_day > 0) {
          const today = new Date().toISOString().split("T")[0];
          const { count: redCount } = await supabase
            .from("voucher_redemptions")
            .select("*", { count: "exact", head: true })
            .eq("voucher_id", voucher.id)
            .gte("redeemed_at", today + "T00:00:00Z")
            .lte("redeemed_at", today + "T23:59:59Z");
          if (redCount && redCount >= voucher.limit_per_day) {
            return new Response(JSON.stringify({ error: "Voucher daily limit reached" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        voucherId = voucher.id;
        if (voucher.type === "percent") {
          voucherDiscount = Math.round((afterDiscount * voucher.value) / 100);
        } else {
          voucherDiscount = Math.min(voucher.value, afterDiscount);
        }
      }
    }

    const finalTotal = total - voucherDiscount;
    const finalGrandTotal = roundTo100(finalTotal);

    // Insert order
    const paymentStatus = payment_method === "qris" ? "awaiting-proof" : "none";

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        member_id: member_id || null,
        table_name,
        items: validatedItems,
        subtotal,
        discount,
        tax,
        delivery_fee: deliveryFee,
        total: finalTotal,
        grand_total: finalGrandTotal,
        status: "pending",
        payment_method,
        payment_status: paymentStatus,
        voucher_id: voucherId,
        date: new Date().toISOString().split("T")[0],
        phone: phone || null,
        is_member: isMember,
      })
      .select("id")
      .single();

    if (orderError) throw orderError;

    // Record voucher redemption if applicable
    if (voucherId) {
      await supabase.from("voucher_redemptions").insert({
        voucher_id: voucherId,
        order_id: order.id,
        table_name,
      });
    }

    // Record initial status history
    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: "pending",
      changed_by: member_id || null,
    });

    // Push to Olsera POS (best-effort, don't fail the order if Olsera is down)
    if (isOlseraConfigured()) {
      try {
        const olseraHeaders = await getOlseraHeaders();
        if (olseraHeaders) {
          const olseraPayload = {
            table_name,
            items: validatedItems.map((i) => ({
              product_id: i.product_id,
              name: i.name,
              variant: i.variant,
              quantity: i.quantity,
              price: i.price,
            })),
            total: finalGrandTotal,
            payment_method,
          };
          const olseraResp = await fetch("https://api-open.olsera.co.id/open-api/v1/order", {
            method: "POST",
            headers: olseraHeaders,
            body: JSON.stringify(olseraPayload),
          });
          if (olseraResp.ok) {
            const olseraData = await olseraResp.json();
            const olseraOrderId = olseraData.id || olseraData.data?.id || olseraData.order_id;
            if (olseraOrderId) {
              await supabase
                .from("orders")
                .update({ olsera_order_id: String(olseraOrderId) })
                .eq("id", order.id);
            }
          }
        }
      } catch {
        // Olsera push failed — order still saved in Supabase
      }
    }

    // Send push notification to staff (best-effort)
    try {
      const { data: tokens } = await supabase
        .from("staff_push_tokens")
        .select("token")
        .eq("role", "staff");
      if (tokens && tokens.length > 0) {
        // Push notification would go here via OneSignal or similar service
        // For now, we just log — the staff dashboard uses realtime subscriptions
      }
    } catch {
      // Push failed — not critical
    }

    return new Response(JSON.stringify({ success: true, order_id: order.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to create order" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
