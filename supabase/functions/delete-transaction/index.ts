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

    const callerId = userData.user.id;

    const { data: admin } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", callerId)
      .maybeSingle();

    if (!admin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { transaction_id } = await req.json();

    if (!transaction_id) {
      return new Response(JSON.stringify({ error: "Transaction ID is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tx, error: txError } = await supabase
      .from("loyalty_transactions")
      .select("*")
      .eq("id", transaction_id)
      .maybeSingle();

    if (txError || !tx) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderId = tx.order_id;

    // Reverse the transaction's effect on member spending and points
    if (tx.amount > 0 || tx.points_earned > 0) {
      const { data: m } = await supabase
        .from("members")
        .select("redeemable_points, spending_since_upgrade, monthly_since_upgrade, yearly_since_upgrade")
        .eq("user_id", tx.member_id)
        .maybeSingle();

      if (m) {
        await supabase.from("members").update({
          redeemable_points: Math.max(0, m.redeemable_points - tx.points_earned),
          spending_since_upgrade: Math.max(0, m.spending_since_upgrade - tx.amount),
          monthly_since_upgrade: Math.max(0, m.monthly_since_upgrade - tx.amount),
          yearly_since_upgrade: Math.max(0, m.yearly_since_upgrade - tx.amount),
        }).eq("user_id", tx.member_id);
      }
    }

    // Delete the loyalty transaction
    await supabase.from("loyalty_transactions").delete().eq("id", transaction_id);

    // Delete the referenced order and its cascaded items (order_status_history, voucher_redemptions)
    if (orderId) {
      await supabase.from("orders").delete().eq("id", orderId);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Failed to delete transaction" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
