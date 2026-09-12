// delete-transaction: deletes a loyalty transaction, its referenced order,
// then recalculates the member's spending, points, and tier from ALL remaining transactions.
// verify_jwt is set to false in config.toml so preflight OPTIONS requests pass without a JWT.

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

function getTier(spending: number, settings: Record<string, number>): string {
  if (spending >= settings.gold_stay_yearly) return "Gold";
  if (spending >= settings.silver_to_gold_yearly) return "Silver";
  if (spending >= settings.bronze_to_silver_yearly) return "Bronze";
  if (spending >= settings.classic_to_bronze_monthly) return "Bronze";
  return "Classic";
}

function getDiscountRate(tier: string, settings: Record<string, number>): number {
  if (tier === "Gold") return settings.gold_discount_rate;
  if (tier === "Silver") return settings.silver_discount_rate;
  if (tier === "Bronze") return settings.bronze_discount_rate;
  return 0;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authentication required" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) return jsonResponse({ error: "Invalid authentication" }, 401);

    const { data: admin } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!admin) return jsonResponse({ error: "Admin access required" }, 403);

    const body = await req.json();
    const transactionId = body.transaction_id;
    if (!transactionId) return jsonResponse({ error: "Transaction ID is required" }, 400);

    const { data: tx, error: txError } = await supabase
      .from("loyalty_transactions")
      .select("id, member_id, order_id")
      .eq("id", transactionId)
      .maybeSingle();
    if (txError || !tx) return jsonResponse({ error: "Transaction not found" }, 404);

    const { error: deleteError } = await supabase
      .from("loyalty_transactions")
      .delete()
      .eq("id", transactionId);
    if (deleteError) throw deleteError;

    if (tx.order_id) {
      const { error: orderError } = await supabase
        .from("orders")
        .delete()
        .eq("id", tx.order_id);
      if (orderError) throw orderError;
    }

    const [{ data: remainingTransactions, error: remainingError }, { data: member, error: memberError }, { data: settings, error: settingsError }] = await Promise.all([
      supabase
        .from("loyalty_transactions")
        .select("amount, points_earned")
        .eq("member_id", tx.member_id),
      supabase
        .from("members")
        .select("user_id")
        .eq("user_id", tx.member_id)
        .maybeSingle(),
      supabase
        .from("settings")
        .select("classic_to_bronze_monthly, bronze_to_silver_yearly, silver_to_gold_yearly, gold_stay_yearly, bronze_discount_rate, silver_discount_rate, gold_discount_rate")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    if (remainingError) throw remainingError;
    if (memberError) throw memberError;
    if (settingsError) throw settingsError;
    if (!member) return jsonResponse({ error: "Member not found" }, 404);
    if (!settings) return jsonResponse({ error: "Settings not configured" }, 500);

    const spending = Math.max(0, (remainingTransactions || []).reduce((sum, item) => sum + Number(item.amount || 0), 0));
    const points = Math.max(0, (remainingTransactions || []).reduce((sum, item) => sum + Number(item.points_earned || 0), 0));
    const tier = getTier(spending, settings);

    const { error: updateError } = await supabase
      .from("members")
      .update({
        spending_since_upgrade: spending,
        monthly_since_upgrade: spending,
        yearly_since_upgrade: spending,
        redeemable_points: points,
        tier,
        discount_rate: getDiscountRate(tier, settings),
        upgrade_date: tier === "Classic" ? null : new Date().toISOString().split("T")[0],
      })
      .eq("user_id", tx.member_id);
    if (updateError) throw updateError;

    return jsonResponse({ success: true, tier_changed: true, new_tier: tier });
  } catch (err) {
    console.error("delete transaction failed", err);
    return jsonResponse({ error: "Failed to delete transaction" }, 500);
  }
});
