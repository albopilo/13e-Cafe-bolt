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

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@13ecafe.com";

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
    return resp.ok;
  } catch {
    return false;
  }
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

    const now = new Date();
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Find members with birthday today who haven't been emailed in last 7 days
    const { data: birthdayMembers } = await supabase
      .from("members")
      .select("user_id, name, email, tier, birthdate, last_birthday_email_sent")
      .eq("birth_month", todayMonth)
      .eq("birth_day", todayDay)
      .or(`last_birthday_email_sent.is.null,last_birthday_email_sent.lt.${sevenDaysAgo}`);

    let emailsSent = 0;
    for (const member of birthdayMembers || []) {
      if (!member.email) continue;

      const tierPerks: Record<string, string> = {
        Bronze: "Free drink or snack + 30% off Honda service",
        Silver: "Free drink and snack + 50% off Millennium hotel + 30% off Honda service",
        Gold: "Free deluxe room (1 night) + Free food/drink/snack combo + 30% cashback + VIP lounge access",
      };

      const html = `
        <h1>Happy Birthday, ${member.name}!</h1>
        <p>13e Café wishes you a wonderful birthday!</p>
        <p>As a ${member.tier} member, enjoy these birthday perks:</p>
        <p>${tierPerks[member.tier] || "Special birthday treats await you!"}</p>
        <p>Visit us soon to claim your perks!</p>
        <p>— The 13e Café Team</p>
      `;

      const sent = await sendEmail(member.email, "Happy Birthday from 13e Café!", html);
      if (sent) {
        await supabase
          .from("members")
          .update({ last_birthday_email_sent: now.toISOString() })
          .eq("user_id", member.user_id);
        emailsSent++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      emails_sent: emailsSent,
      checked: birthdayMembers?.length || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Failed to send birthday emails" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
