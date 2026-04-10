import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendBrevoEmail(params: {
  toEmail: string;
  toName: string;
  subject: string;
  htmlContent: string;
}): Promise<void> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) return;

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      to: [{ email: params.toEmail, name: params.toName }],
      subject: params.subject,
      htmlContent: params.htmlContent,
      sender: { name: "Team Booking", email: "noreply@teambooking.app" },
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing cancellation token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find all bookings with this token
    const { data: bookings, error: fetchError } = await supabase
      .from("bookings")
      .select("id, booker_name, booker_email, meeting_date, meeting_time, duration_minutes, status, team_member_id")
      .eq("cancellation_token", token);

    if (fetchError || !bookings || bookings.length === 0) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const booking = bookings[0];

    if (booking.status === "cancelled") {
      return new Response(JSON.stringify({ error: "Booking is already cancelled" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cancel all bookings with this token
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("cancellation_token", token);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to cancel booking" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch team member names and emails for notification
    const memberIds = bookings.map((b: { team_member_id: string }) => b.team_member_id).filter(Boolean);
    const { data: members } = await supabase
      .from("team_members")
      .select("name, email")
      .in("id", memberIds);

    const memberLabel = (members ?? []).length === 0
      ? "the team"
      : (members ?? []).map((m: { name: string }) => m.name).join(" & ");

    // Cancellation email to booker
    const bookerHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
        <h2 style="color: #cc0000;">Meeting Cancelled</h2>
        <p>Hi ${booking.booker_name},</p>
        <p>Your meeting has been successfully cancelled.</p>
        <div style="background: #fff0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 8px;"><strong>Meeting:</strong> Meeting with ${memberLabel}</p>
          <p style="margin: 0 0 8px;"><strong>Date:</strong> ${booking.meeting_date}</p>
          <p style="margin: 0 0 8px;"><strong>Time:</strong> ${booking.meeting_time} (America/Los_Angeles)</p>
        </div>
        <p>If you'd like to reschedule, please visit the booking page.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;">
        <p style="font-size: 12px; color: #666;">Powered by Team Booking</p>
      </div>
    `;

    await sendBrevoEmail({
      toEmail: booking.booker_email,
      toName: booking.booker_name,
      subject: `Cancelled: Meeting with ${memberLabel} on ${booking.meeting_date}`,
      htmlContent: bookerHtml,
    });

    // Notify each team member
    for (const member of (members ?? []) as { name: string; email: string | null }[]) {
      if (!member.email) continue;

      const memberHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
          <h2 style="color: #cc0000;">Meeting Cancelled</h2>
          <p>Hi ${member.name},</p>
          <p>${booking.booker_name} has cancelled their meeting with you.</p>
          <div style="background: #fff0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px;"><strong>Booker:</strong> ${booking.booker_name} (${booking.booker_email})</p>
            <p style="margin: 0 0 8px;"><strong>Date:</strong> ${booking.meeting_date}</p>
            <p style="margin: 0 0 8px;"><strong>Time:</strong> ${booking.meeting_time} (America/Los_Angeles)</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;">
          <p style="font-size: 12px; color: #666;">Powered by Team Booking</p>
        </div>
      `;

      await sendBrevoEmail({
        toEmail: member.email,
        toName: member.name,
        subject: `Cancelled: ${booking.booker_name}'s meeting on ${booking.meeting_date}`,
        htmlContent: memberHtml,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cancel-booking error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
