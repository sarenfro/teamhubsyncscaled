import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateCancelICS(params: {
  uid: string;
  title: string;
  dateStr: string;
  timeStr: string;
  durationMinutes: number;
  bookerName: string;
  bookerEmail: string;
  organizerName: string;
}): string {
  const { uid, title, dateStr, timeStr, durationMinutes, bookerName, bookerEmail, organizerName } = params;

  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!timeMatch) return "";

  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const period = timeMatch[3].toLowerCase();
  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;

  const [y, m, d] = dateStr.split("-").map(Number);

  // Convert America/Los_Angeles local time to UTC
  let startUTC = new Date(Date.UTC(y, m - 1, d, hours + 8, minutes));
  for (const offset of [7, 8]) {
    const testDate = new Date(Date.UTC(y, m - 1, d, hours + offset, minutes));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(testDate);
    const p: Record<string, number> = {};
    parts.forEach(({ type, value }) => { if (type !== "literal") p[type] = parseInt(value); });
    if (p.hour % 24 === hours && p.minute === minutes) {
      startUTC = testDate;
      break;
    }
  }

  const endUTC = new Date(startUTC.getTime() + durationMinutes * 60 * 1000);
  const fmtDt = (dt: Date) =>
    dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Team Booking//EN",
    "METHOD:CANCEL",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmtDt(new Date())}`,
    `DTSTART:${fmtDt(startUTC)}`,
    `DTEND:${fmtDt(endUTC)}`,
    `SUMMARY:Cancelled: ${title}`,
    `DESCRIPTION:This meeting has been cancelled by ${bookerName}`,
    `ORGANIZER;CN="${organizerName}":mailto:noreply@teambooking.app`,
    `ATTENDEE;CN="${bookerName}":mailto:${bookerEmail}`,
    "STATUS:CANCELLED",
    "SEQUENCE:1",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

async function sendBrevoEmail(params: {
  toEmail: string;
  toName: string;
  subject: string;
  htmlContent: string;
  icsContent?: string;
}): Promise<void> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) return;

  const body: Record<string, unknown> = {
    to: [{ email: params.toEmail, name: params.toName }],
    subject: params.subject,
    htmlContent: params.htmlContent,
    sender: { name: "Team Booking", email: "noreply@teambooking.app" },
  };

  if (params.icsContent) {
    body.attachment = [{ name: "cancel-meeting.ics", content: btoa(params.icsContent) }];
  }

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify(body),
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
      .select("id, booker_name, booker_email, meeting_date, meeting_time, duration_minutes, status, team_member_id, ics_uid")
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

    const meetingTitle = `Meeting with ${memberLabel}`;

    // Generate METHOD:CANCEL ICS if we have the UID
    let cancelIcs: string | undefined;
    if (booking.ics_uid) {
      cancelIcs = generateCancelICS({
        uid: booking.ics_uid,
        title: meetingTitle,
        dateStr: booking.meeting_date,
        timeStr: booking.meeting_time,
        durationMinutes: booking.duration_minutes || 30,
        bookerName: booking.booker_name,
        bookerEmail: booking.booker_email,
        organizerName: memberLabel,
      });
    }

    // Cancellation email to booker
    const bookerHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
        <h2 style="color: #cc0000;">Meeting Cancelled</h2>
        <p>Hi ${booking.booker_name},</p>
        <p>Your meeting has been successfully cancelled.</p>
        <div style="background: #fff0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 8px;"><strong>Meeting:</strong> ${meetingTitle}</p>
          <p style="margin: 0 0 8px;"><strong>Date:</strong> ${booking.meeting_date}</p>
          <p style="margin: 0 0 8px;"><strong>Time:</strong> ${booking.meeting_time} (America/Los_Angeles)</p>
        </div>
        <p>The attached calendar file (.ics) will remove this event from your calendar.</p>
        <p>If you'd like to reschedule, please visit the booking page.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;">
        <p style="font-size: 12px; color: #666;">Powered by Team Booking</p>
      </div>
    `;

    await sendBrevoEmail({
      toEmail: booking.booker_email,
      toName: booking.booker_name,
      subject: `Cancelled: ${meetingTitle} on ${booking.meeting_date}`,
      htmlContent: bookerHtml,
      icsContent: cancelIcs,
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
          <p>The attached calendar file (.ics) will remove this event from your calendar.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;">
          <p style="font-size: 12px; color: #666;">Powered by Team Booking</p>
        </div>
      `;

      await sendBrevoEmail({
        toEmail: member.email,
        toName: member.name,
        subject: `Cancelled: ${booking.booker_name}'s meeting on ${booking.meeting_date}`,
        htmlContent: memberHtml,
        icsContent: cancelIcs,
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
