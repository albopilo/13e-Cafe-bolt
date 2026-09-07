import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { voucher_code, order_id, table_name, subtotal } = await req.json();

    if (!voucher_code || !order_id) {
      return new Response(JSON.stringify({ error: "Voucher code and order ID are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up voucher
    const { data: voucher, error: vError } = await supabase
      .from("vouchers")
      .select("id, type, value, limit_per_day, active")
      .eq("code", voucher_code)
      .eq("active", true)
      .maybeSingle();

    if (vError) throw vError;
    if (!voucher) {
      return new Response(JSON.stringify({ error: "Invalid or inactive voucher" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check daily limit atomically
    if (voucher.limit_per_day > 0) {
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase
        .from("voucher_redemptions")
        .select("*", { count: "exact", head: true })
        .eq("voucher_id", voucher.id)
        .gte("redeemed_at", today + "T00:00:00Z")
        .lte("redeemed_at", today + "T23:59:59Z");
      if (count && count >= voucher.limit_per_day) {
        return new Response(JSON.stringify({ error: "Voucher daily limit reached" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check if already redeemed for this order
    const { data: existing } = await supabase
      .from("voucher_redemptions")
      .select("id")
      .eq("order_id", order_id)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: "Voucher already applied to this order" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute voucher discount
    let voucherDiscount = 0;
    if (voucher.type === "percent") {
      voucherDiscount = Math.round((subtotal * voucher.value) / 100);
    } else {
      voucherDiscount = Math.min(voucher.value, subtotal);
    }

    // Record redemption
    const { error: redeemError } = await supabase
      .from("voucher_redemptions")
      .insert({
        voucher_id: voucher.id,
        order_id,
        table_name,
      });

    if (redeemError) throw redeemError;

    // Update order with voucher and recompute totals
    const { data: order } = await supabase
      .from("orders")
      .select("subtotal, discount, tax, delivery_fee, total, grand_total")
      .eq("id", order_id)
      .single();

    if (order) {
      const newTotal = order.total - voucherDiscount;
      const newGrandTotal = Math.round(newTotal / 100) * 100;
      await supabase
        .from("orders")
        .update({
          voucher_id: voucher.id,
          total: newTotal,
          grand_total: newGrandTotal,
        })
        .eq("id", order_id);
    }

    return new Response(JSON.stringify({
      success: true,
      voucher_discount: voucherDiscount,
      new_total: order ? order.total - voucherDiscount : null,
      new_grand_total: order ? Math.round((order.total - voucherDiscount) / 100) * 100 : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to apply voucher" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
