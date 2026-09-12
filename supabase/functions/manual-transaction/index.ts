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

const TIER_ORDER = ["Classic", "Bronze", "Silver", "Gold"];

function getTierThresholds(settings: Record<string, number>) {
  return {
    Classic: { threshold: 0, discount: 0, cashback: 0, dailyCap: 0 },
    Bronze: { threshold: settings.bronze_to_silver_yearly, discount: settings.bronze_discount_rate, cashback: 0, dailyCap: 0 },
    Silver: { threshold: settings.silver_to_gold_yearly, discount: settings.silver_discount_rate, cashback: settings.silver_cashback_rate, dailyCap: settings.silver_daily_cashback_cap },
    Gold: { threshold: settings.gold_stay_yearly, discount: settings.gold_discount_rate, cashback: settings.gold_cashback_rate, dailyCap: settings.gold_daily_cashback_cap },
  };
}

function getTierFromSpending(spending: number, currentTier: string, settings: Record<string, number>): string {
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Check if admin or Main Kitchen staff
    const { data: admin } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    let isMainKitchen = false;
    if (!admin) {
      const { data: staff } = await supabase
        .from("staff")
        .select("assigned_location")
        .eq("user_id", userId)
        .maybeSingle();
      if (!staff || staff.assigned_location !== "Main Kitchen") {
        return new Response(JSON.stringify({ error: "Only admins and Main Kitchen staff can add manual transactions" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      isMainKitchen = true;
    }

    const body = await req.json();
    const { member_id, amount, note, receipt_url, table_name } = body;

    if (!member_id || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Member ID and a positive amount are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amount > 10000000) {
      return new Response(JSON.stringify({ error: "Amount exceeds maximum (Rp10,000,000)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch settings
    const { data: settingsData } = await supabase
      .from("settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    const settings = settingsData as Record<string, number> | null;
    if (!settings) {
      return new Response(JSON.stringify({ error: "Settings not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch member
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("*")
      .eq("user_id", member_id)
      .maybeSingle();

    if (memberError || !member) {
      return new Response(JSON.stringify({ error: "Member not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const thresholds = getTierThresholds(settings);
    const tierConfig = thresholds[member.tier] || thresholds.Classic;
    let cashbackRate = tierConfig.cashback;
    const dailyCap = tierConfig.dailyCap;

    if (isBirthdayMonth(member.birthdate) && member.tier === "Gold") {
      cashbackRate += settings.birthday_gold_cashback_rate;
    }

    let cashback = Math.round(amount * cashbackRate);

    // Enforce daily cashback cap
    if (dailyCap > 0) {
      const today = new Date().toISOString().split("T")[0];
      const dailyEarned = (member.daily_cashback_date === today) ? member.daily_cashback_earned : 0;
      const remaining = Math.max(0, dailyCap - dailyEarned);
      cashback = Math.min(cashback, remaining);
    }

    const pointsEarned = cashback;
    const today = new Date().toISOString().split("T")[0];

    // Record loyalty transaction
    const { data: tx, error: txError } = await supabase
      .from("loyalty_transactions")
      .insert({
        member_id,
        order_id: null,
        amount,
        cashback,
        points_earned: pointsEarned,
        source: "manual_transaction",
        table_name: table_name || "Manual",
        note: note || null,
        receipt_url: receipt_url || null,
        manual: true,
      })
      .select("id")
      .single();

    if (txError) throw txError;

    // Update member spending and points
    const newSpending = member.spending_since_upgrade + amount;
    const newMonthly = member.monthly_since_upgrade + amount;
    const newYearly = member.yearly_since_upgrade + amount;
    const newPoints = member.redeemable_points + pointsEarned;

    // Check for tier upgrade
    const newTier = getTierFromSpending(newSpending, member.tier, settings);
    const tierChanged = newTier !== member.tier;

    const updateData: Record<string, unknown> = {
      spending_since_upgrade: tierChanged ? 0 : newSpending,
      monthly_since_upgrade: tierChanged ? 0 : newMonthly,
      yearly_since_upgrade: tierChanged ? 0 : newYearly,
      redeemable_points: newPoints,
      daily_cashback_earned: cashback,
      daily_cashback_date: today,
    };

    if (tierChanged) {
      updateData.tier = newTier;
      updateData.discount_rate = thresholds[newTier].discount;
      updateData.upgrade_date = today;
    }

    await supabase
      .from("members")
      .update(updateData)
      .eq("user_id", member_id);

    return new Response(JSON.stringify({
      success: true,
      transaction_id: tx.id,
      cashback,
      points_earned: pointsEarned,
      tier_changed: tierChanged,
      new_tier: tierChanged ? newTier : member.tier,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Failed to create manual transaction" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
