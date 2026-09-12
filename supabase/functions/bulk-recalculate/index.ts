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
    Classic: { threshold: 0, discount: 0 },
    Bronze: { threshold: settings.bronze_to_silver_yearly, discount: settings.bronze_discount_rate },
    Silver: { threshold: settings.silver_to_gold_yearly, discount: settings.silver_discount_rate },
    Gold: { threshold: settings.gold_stay_yearly, discount: settings.gold_discount_rate },
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

    // Check admin
    const { data: admin } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!admin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // Fetch all members
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("user_id, tier, spending_since_upgrade, monthly_since_upgrade, yearly_since_upgrade, created_at, tier_restored_at")
      .order("created_at", { ascending: true });

    if (membersError) throw membersError;

    const thresholds = getTierThresholds(settings);
    const currentYear = new Date().getFullYear();
    let upgraded = 0;
    let downgraded = 0;
    let unchanged = 0;

    for (const member of members || []) {
      const newTier = getTierFromSpending(member.spending_since_upgrade, member.tier, settings);
      const tierChanged = newTier !== member.tier;

      // Demotion protection: members created this year are protected
      const memberCreatedYear = new Date(member.created_at).getFullYear();
      const isProtected = memberCreatedYear === currentYear;

      if (tierChanged) {
        // Only upgrade via recalculation, don't downgrade protected members
        const newTierIndex = TIER_ORDER.indexOf(newTier);
        const currentTierIndex = TIER_ORDER.indexOf(member.tier);

        if (newTierIndex > currentTierIndex) {
          // Upgrade
          await supabase
            .from("members")
            .update({
              tier: newTier,
              discount_rate: thresholds[newTier].discount,
              spending_since_upgrade: 0,
              monthly_since_upgrade: 0,
              yearly_since_upgrade: 0,
              upgrade_date: new Date().toISOString().split("T")[0],
            })
            .eq("user_id", member.user_id);
          upgraded++;
        } else if (!isProtected) {
          // Downgrade (not protected)
          await supabase
            .from("members")
            .update({
              tier: newTier,
              discount_rate: thresholds[newTier].discount,
              upgrade_date: new Date().toISOString().split("T")[0],
            })
            .eq("user_id", member.user_id);
          downgraded++;
        } else {
          unchanged++;
        }
      } else {
        unchanged++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_members: members?.length || 0,
      upgraded,
      downgraded,
      unchanged,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Failed to recalculate tiers" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
