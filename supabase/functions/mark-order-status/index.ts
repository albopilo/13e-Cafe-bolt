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

interface Settings {
  classic_to_bronze_monthly: number;
  bronze_to_silver_monthly: number;
  bronze_to_silver_yearly: number;
  silver_to_gold_monthly: number;
  silver_to_gold_yearly: number;
  silver_stay_yearly: number;
  gold_stay_yearly: number;
  silver_cashback_rate: number;
  gold_cashback_rate: number;
  birthday_gold_cashback_rate: number;
  silver_daily_cashback_cap: number;
  gold_daily_cashback_cap: number;
  bronze_discount_rate: number;
  silver_discount_rate: number;
  gold_discount_rate: number;
}

const TIER_ORDER = ["Classic", "Bronze", "Silver", "Gold"];

function getTierThresholds(settings: Settings): Record<string, { threshold: number; discount: number; cashback: number; dailyCap: number }> {
  return {
    Classic: { threshold: 0, discount: 0, cashback: 0, dailyCap: 0 },
    Bronze: { threshold: settings.bronze_to_silver_yearly, discount: settings.bronze_discount_rate, cashback: 0, dailyCap: 0 },
    Silver: { threshold: settings.silver_to_gold_yearly, discount: settings.silver_discount_rate, cashback: settings.silver_cashback_rate, dailyCap: settings.silver_daily_cashback_cap },
    Gold: { threshold: settings.gold_stay_yearly, discount: settings.gold_discount_rate, cashback: settings.gold_cashback_rate, dailyCap: settings.gold_daily_cashback_cap },
  };
}

function getTierFromSpending(spending: number, currentTier: string, settings: Settings): string {
  const thresholds = getTierThresholds(settings);
  let newTier = currentTier;
  for (const tier of TIER_ORDER) {
    const config = thresholds[tier];
    if (spending >= config.threshold && config.threshold > 0) {
      newTier = tier;
    }
  }
  return newTier;
}

function isBirthdayMonth(birthdate: string | null): boolean {
  if (!birthdate) return false;
  const today = new Date();
  const birth = new Date(birthdate);
  return today.getMonth() === birth.getMonth();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { order_id, new_status, changed_by } = await req.json();

    if (!order_id || !new_status) {
      return new Response(JSON.stringify({ error: "Order ID and new status are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validStatuses = ["pending", "preparing", "served", "cancelled"];
    if (!validStatuses.includes(new_status)) {
      return new Response(JSON.stringify({ error: "Invalid status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError) throw orderError;
    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user is authorized to update this order
    if (changed_by) {
      const { data: admin } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", changed_by)
        .maybeSingle();

      if (!admin) {
        const { data: staff } = await supabase
          .from("staff")
          .select("assigned_location")
          .eq("user_id", changed_by)
          .maybeSingle();

        if (!staff) {
          return new Response(JSON.stringify({ error: "You are not authorized to update orders" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!order.table_name.startsWith(staff.assigned_location)) {
          return new Response(JSON.stringify({ error: "You can only manage orders from your assigned location" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Update order status
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: new_status })
      .eq("id", order_id);

    if (updateError) throw updateError;

    // Record status history
    await supabase.from("order_status_history").insert({
      order_id,
      status: new_status,
      changed_by: changed_by || null,
    });

    // Fetch settings
    const { data: settingsData } = await supabase
      .from("settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    const settings = settingsData as Settings | null;

    // Handle loyalty on "served"
    if (new_status === "served" && order.is_member && order.member_id && !order.loyalty_recorded) {
      const { data: member } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", order.member_id)
        .maybeSingle();

      if (member) {
        const thresholds = settings ? getTierThresholds(settings) : null;
        let cashbackRate = 0;
        let dailyCap = 0;

        if (thresholds) {
          const tierConfig = thresholds[member.tier] || thresholds.Classic;
          cashbackRate = tierConfig.cashback;
          dailyCap = tierConfig.dailyCap;
          if (isBirthdayMonth(member.birthdate) && member.tier === "Gold" && settings) {
            cashbackRate += settings.birthday_gold_cashback_rate;
          }
        }

        let cashback = Math.round(order.total * cashbackRate);

        // Enforce daily cashback cap
        if (dailyCap > 0) {
          const today = new Date().toISOString().split("T")[0];
          const dailyEarned = (member.daily_cashback_date === today) ? member.daily_cashback_earned : 0;
          const remaining = Math.max(0, dailyCap - dailyEarned);
          cashback = Math.min(cashback, remaining);
        }

        const pointsEarned = cashback;

        // Record loyalty transaction
        const { data: tx } = await supabase
          .from("loyalty_transactions")
          .insert({
            member_id: order.member_id,
            order_id,
            amount: order.total,
            cashback,
            points_earned: pointsEarned,
            source: "order_served",
            table_name: order.table_name,
            manual: false,
          })
          .select("id")
          .single();

        // Update member spending and points
        const newSpending = member.spending_since_upgrade + order.total;
        const newMonthly = member.monthly_since_upgrade + order.total;
        const newYearly = member.yearly_since_upgrade + order.total;
        const newPoints = member.redeemable_points + pointsEarned;

        // Check for tier upgrade
        const newTier = settings
          ? getTierFromSpending(newSpending, member.tier, settings)
          : member.tier;
        const tierChanged = newTier !== member.tier;

        const today = new Date().toISOString().split("T")[0];
        const updateData: Record<string, unknown> = {
          spending_since_upgrade: tierChanged ? 0 : newSpending,
          monthly_since_upgrade: tierChanged ? 0 : newMonthly,
          yearly_since_upgrade: tierChanged ? 0 : newYearly,
          redeemable_points: newPoints,
          daily_cashback_earned: cashback,
          daily_cashback_date: today,
        };

        if (tierChanged && settings) {
          updateData.tier = newTier;
          const thresholds2 = getTierThresholds(settings);
          updateData.discount_rate = thresholds2[newTier].discount;
          updateData.upgrade_date = today;
        }

        await supabase
          .from("members")
          .update(updateData)
          .eq("user_id", order.member_id);

        // Mark loyalty as recorded
        await supabase
          .from("orders")
          .update({
            loyalty_recorded: true,
            loyalty_tx_id: tx?.id || null,
          })
          .eq("id", order_id);

        // Push customer update to Olsera (best-effort)
        if (isOlseraConfigured()) {
          try {
            const olseraHeaders = await getOlseraHeaders();
            if (olseraHeaders) {
              await fetch(`https://api-open.olsera.co.id/open-api/v1/customer/${order.member_id}`, {
                method: "PUT",
                headers: olseraHeaders,
                body: JSON.stringify({
                  name: member.name,
                  phone: member.phone,
                  email: member.email,
                  tier: tierChanged ? newTier : member.tier,
                  points: newPoints,
                }),
              });
            }
          } catch {
            // Best-effort
          }
        }
      }
    }

    // Handle loyalty reversal on "cancelled"
    if (new_status === "cancelled" && order.loyalty_recorded && order.member_id) {
      const { data: tx } = await supabase
        .from("loyalty_transactions")
        .select("*")
        .eq("order_id", order_id)
        .eq("source", "order_served")
        .maybeSingle();

      if (tx) {
        await supabase.from("loyalty_transactions").insert({
          member_id: order.member_id,
          order_id,
          amount: -order.total,
          cashback: -tx.cashback,
          points_earned: -tx.points_earned,
          source: "order_cancelled",
          table_name: order.table_name,
          manual: false,
        });

        const { data: member } = await supabase
          .from("members")
          .select("redeemable_points, spending_since_upgrade, monthly_since_upgrade, yearly_since_upgrade")
          .eq("user_id", order.member_id)
          .maybeSingle();

        if (member) {
          await supabase
            .from("members")
            .update({
              redeemable_points: Math.max(0, member.redeemable_points - tx.points_earned),
              spending_since_upgrade: Math.max(0, member.spending_since_upgrade - order.total),
              monthly_since_upgrade: Math.max(0, member.monthly_since_upgrade - order.total),
              yearly_since_upgrade: Math.max(0, member.yearly_since_upgrade - order.total),
            })
            .eq("user_id", order.member_id);
        }

        await supabase
          .from("orders")
          .update({ loyalty_recorded: false })
          .eq("id", order_id);
      }
    }

    return new Response(JSON.stringify({ success: true, order_id, status: new_status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Failed to update order status" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
