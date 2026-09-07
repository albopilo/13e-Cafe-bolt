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

const TIER_CONFIGS: Record<string, { threshold: number; discount: number; cashback: number }> = {
  Classic: { threshold: 0, discount: 0, cashback: 0 },
  Bronze: { threshold: 500000, discount: 0.10, cashback: 0.05 },
  Silver: { threshold: 1500000, discount: 0.15, cashback: 0.07 },
  Gold: { threshold: 3000000, discount: 0.20, cashback: 0.10 },
};

const TIER_ORDER = ["Classic", "Bronze", "Silver", "Gold"];

function getTierFromSpending(spending: number, currentTier: string): string {
  let newTier = currentTier;
  for (const tier of TIER_ORDER) {
    const config = TIER_CONFIGS[tier];
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

    // Get current order
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

    // Handle loyalty on "served"
    if (new_status === "served" && order.is_member && order.member_id && !order.loyalty_recorded) {
      const { data: member } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", order.member_id)
        .maybeSingle();

      if (member) {
        const tierConfig = TIER_CONFIGS[member.tier] || TIER_CONFIGS.Classic;
        let cashbackRate = tierConfig.cashback;
        if (isBirthdayMonth(member.birthdate) && member.tier === "Gold") {
          cashbackRate += 0.15;
        }

        const cashback = Math.round(order.total * cashbackRate);
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
          })
          .select("id")
          .single();

        // Update member spending and points
        const newSpending = member.spending_since_upgrade + order.total;
        const newMonthly = member.monthly_since_upgrade + order.total;
        const newYearly = member.yearly_since_upgrade + order.total;
        const newPoints = member.redeemable_points + pointsEarned;

        // Check for tier upgrade
        const newTier = getTierFromSpending(newSpending, member.tier);
        const tierChanged = newTier !== member.tier;

        const updateData: any = {
          spending_since_upgrade: tierChanged ? 0 : newSpending,
          monthly_since_upgrade: tierChanged ? 0 : newMonthly,
          yearly_since_upgrade: tierChanged ? 0 : newYearly,
          redeemable_points: newPoints,
        };

        if (tierChanged) {
          updateData.tier = newTier;
          updateData.discount_rate = TIER_CONFIGS[newTier].discount;
          updateData.upgrade_date = new Date().toISOString().split("T")[0];
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
        const olseraBaseUrl = Deno.env.get("OLSSERA_API_BASE_URL");
        const olseraToken = Deno.env.get("OLSSERA_API_TOKEN");
        if (olseraBaseUrl && olseraToken) {
          try {
            await fetch(`${olseraBaseUrl}/customers/${order.member_id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${olseraToken}`,
              },
              body: JSON.stringify({
                name: member.name,
                phone: member.phone,
                email: member.email,
                tier: tierChanged ? newTier : member.tier,
                points: newPoints,
              }),
            });
          } catch {
            // Best-effort
          }
        }
      }
    }

    // Handle loyalty reversal on "cancelled"
    if (new_status === "cancelled" && order.loyalty_recorded && order.member_id) {
      // Reverse the loyalty transaction
      const { data: tx } = await supabase
        .from("loyalty_transactions")
        .select("*")
        .eq("order_id", order_id)
        .eq("source", "order_served")
        .maybeSingle();

      if (tx) {
        // Record reversal
        await supabase.from("loyalty_transactions").insert({
          member_id: order.member_id,
          order_id,
          amount: -order.total,
          cashback: -tx.cashback,
          points_earned: -tx.points_earned,
          source: "order_cancelled",
          table_name: order.table_name,
        });

        // Deduct points from member
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

        // Mark loyalty as reversed
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
      JSON.stringify({ error: err.message || "Failed to update order status" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
