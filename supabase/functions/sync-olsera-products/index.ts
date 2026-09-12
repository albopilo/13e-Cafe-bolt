import { createClient } from "npm:@supabase/supabase-js@2";
import { getOlseraHeaders, isOlseraConfigured } from "../_shared/olsera.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OLSERA_API_BASE = "https://api-open.olsera.co.id";

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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isOlseraConfigured()) {
      return new Response(JSON.stringify({ error: "Olsera API not configured. Set OLSSERA_APP_ID and OLSSERA_SECRET_KEY secrets." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const olseraHeaders = await getOlseraHeaders();
    if (!olseraHeaders) {
      return new Response(JSON.stringify({ error: "Failed to obtain Olsera access token. Check your app_id and secret_key." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch products from Olsera
    const resp = await fetch(`${OLSERA_API_BASE}/open-api/v1/product/list`, {
      headers: olseraHeaders,
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      return new Response(JSON.stringify({ error: `Olsera API error: ${resp.status}`, detail: errBody }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const olseraData = await resp.json();
    const olseraProducts = olseraData.data || olseraData.products || olseraData || [];

    // Map and upsert into products table
    let synced = 0;
    for (const op of olseraProducts) {
      const productData = {
        name: op.name || op.product_name || "Unknown",
        category: op.category || op.category_name || "Uncategorized",
        variant_label: op.variant_label || "Variant",
        variant_names: op.variants || op.variant_names || ["Regular"],
        pos_sell_price: op.price || op.sell_price || op.pos_sell_price || 0,
        pos_hidden: false,
        olsera_id: String(op.id || op.product_id || op.olsera_id),
        updated_at: new Date().toISOString(),
      };

      // Check if product with this olsera_id exists
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("olsera_id", productData.olsera_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("products")
          .update(productData)
          .eq("id", existing.id);
      } else {
        await supabase
          .from("products")
          .insert(productData);
      }
      synced++;
    }

    return new Response(JSON.stringify({ success: true, synced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to sync products" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
