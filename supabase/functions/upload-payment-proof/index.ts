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

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const orderId = formData.get("order_id") as string;

    if (!file || !orderId) {
      return new Response(JSON.stringify({ error: "File and order ID are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the order belongs to the authenticated user (or caller is admin/staff)
    const { data: order } = await supabase
      .from("orders")
      .select("member_id, table_name")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: admin } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!admin) {
      if (order.member_id && order.member_id !== userData.user.id) {
        return new Response(JSON.stringify({ error: "You can only upload proof for your own orders" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // For guest orders (no member_id), verify the caller's phone matches the order's phone
      if (!order.member_id) {
        const { data: callerMember } = await supabase
          .from("members")
          .select("phone")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        if (callerMember?.phone && order.phone && callerMember.phone !== order.phone) {
          return new Response(JSON.stringify({ error: "You can only upload proof for your own orders" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Validate file type and size (max 5 MB)
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    const declaredType = file.type || "application/octet-stream";
    if (!allowedTypes.includes(declaredType.toLowerCase())) {
      return new Response(JSON.stringify({ error: "Only image files are accepted" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    if (fileBytes.length === 0 || fileBytes.length > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File must be between 1 byte and 5 MB" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `proofs/${orderId}-${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(fileName, fileBytes, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("payment-proofs")
      .getPublicUrl(fileName);

    const proofUrl = urlData.publicUrl;

    await supabase
      .from("orders")
      .update({ proof_url: proofUrl, payment_status: "awaiting-verification" })
      .eq("id", orderId);

    return new Response(JSON.stringify({ success: true, proof_url: proofUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to upload payment proof" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
