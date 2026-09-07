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
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const orderId = formData.get("order_id") as string;

    if (!file || !orderId) {
      return new Response(JSON.stringify({ error: "File and order ID are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `proofs/${orderId}-${Date.now()}.${ext}`;
    const fileBytes = new Uint8Array(await file.arrayBuffer());

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
      .update({ proof_url: proofUrl })
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
