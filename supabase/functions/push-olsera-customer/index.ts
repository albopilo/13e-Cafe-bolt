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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { member_id, name, phone, email, tier, points } = await req.json();

    if (!member_id) {
      return new Response(JSON.stringify({ error: "Member ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isOlseraConfigured()) {
      return new Response(JSON.stringify({ success: false, message: "Olsera API not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const olseraHeaders = await getOlseraHeaders();
    if (!olseraHeaders) {
      return new Response(JSON.stringify({ success: false, message: "Failed to obtain Olsera access token" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = { name, phone, email, tier, points, external_id: member_id };

    // Try PUT first (update existing), fall back to POST (create new)
    const putResp = await fetch(`https://api-open.olsera.co.id/open-api/v1/customer/${member_id}`, {
      method: "PUT",
      headers: olseraHeaders,
      body: JSON.stringify(payload),
    });

    if (putResp.status === 404) {
      const postResp = await fetch("https://api-open.olsera.co.id/open-api/v1/customer", {
        method: "POST",
        headers: olseraHeaders,
        body: JSON.stringify(payload),
      });

      if (!postResp.ok) {
        return new Response(JSON.stringify({ success: false, error: `Olsera POST failed: ${postResp.status}` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (!putResp.ok) {
      return new Response(JSON.stringify({ success: false, error: `Olsera PUT failed: ${putResp.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to push customer to Olsera" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
