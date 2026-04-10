import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateICS(params: {
  title: string;
  dateStr: string;
  timeStr: string;
  durationMinutes: number;
  bookerName: string;
  bookerEmail: string;
  organizerName: string;
}): string {
  const { title, dateStr, timeStr, durationMinutes, bookerName, bookerEmail, organizerName } =
    params;

  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!timeMatch) return "";

  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const period = timeMatch[3].toLowerCase();
  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;

  const [y, m, d] = dateStr.split("-").map(Number);

  // Convert Seattle local time to UTC (try PDT then PST)
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
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@teambooking`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Team Booking//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmtDt(new Date())}`,
    `DTSTART:${fmtDt(startUTC)}`,
    `DTEND:${fmtDt(endUTC)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:Meeting booked by ${bookerName} (${bookerEmail})`,
    `ORGANIZER;CN="${organizerName}":mailto:noreply@teambooking.app`,
    `ATTENDEE;CN="${bookerName}":mailto:${bookerEmail}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

async function sendBrevoEmail(params: {
  toEmail: string;
  toName: string;
  subject: string;
  htmlContent: string;
  icsContent: string;
}): Promise<void> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) {
    console.error("BREVO_API_KEY not set");
    return;
  }

  const body = {
    to: [{ email: params.toEmail, name: params.toName }],
    subject: params.subject,
    htmlContent: params.htmlContent,
    attachment: [
      {
        name: "meeting.ics",
        content: btoa(params.icsContent),
      },
    ],
    sender: { name: "Team Booking", email: "noreply@teambooking.app" },
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error("Brevo error:", await response.text());
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      team_id,
      team_member_ids,
      booker_name,
      booker_email,
      notes,
      meeting_date,
      meeting_time,
      duration_minutes = 30,
    } = await req.json();

    if (!booker_name || !booker_email || !meeting_date || !meeting_time) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const memberIds: string[] = Array.isArray(team_member_ids)
      ? team_member_ids
      : [team_member_ids].filter(Boolean);

    // Insert one booking row per selected member
    for (const memberId of memberIds) {
      await supabase.from("bookings").insert({
        team_id: team_id ?? null,
        team_member_id: memberId,
        booker_name,
        booker_email,
        notes: notes || null,
        meeting_date,
        meeting_time,
        duration_minutes,
        status: "confirmed",
      });
    }

    // Fetch member names for the confirmation email
    const { data: members } = await supabase
      .from("team_members")
      .select("name")
      .in("id", memberIds);

    const memberNames = (members ?? []).map((m: { name: string }) => m.name);
    const memberLabel =
      memberNames.length === 0
        ? "the team"
        : memberNames.length === 1
          ? memberNames[0]
          : memberNames.slice(0, -1).join(", ") + " & " + memberNames[memberNames.length - 1];

    const meetingTitle = `Meeting with ${memberLabel}`;

    // Generate ICS
    const icsContent = generateICS({
      title: meetingTitle,
      dateStr: meeting_date,
      timeStr: meeting_time,
      durationMinutes: duration_minutes,
      bookerName: booker_name,
      bookerEmail: booker_email,
      organizerName: memberLabel,
    });

    // Send confirmation email via Brevo
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
        <h2 style="color: #0066ff;">Meeting Confirmed!</h2>
        <p>Hi ${booker_name},</p>
        <p>Your meeting has been scheduled. Here are the details:</p>
        <div style="background: #f0f4ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 8px;"><strong>Meeting:</strong> ${meetingTitle}</p>
          <p style="margin: 0 0 8px;"><strong>Date:</strong> ${meeting_date}</p>
          <p style="margin: 0 0 8px;"><strong>Time:</strong> ${meeting_time} (America/Los_Angeles)</p>
          <p style="margin: 0 0 8px;"><strong>Duration:</strong> ${duration_minutes} minutes</p>
          ${notes ? `<p style="margin: 0;"><strong>Notes:</strong> ${notes}</p>` : ""}
        </div>
        <p>A calendar invite (.ics) is attached to this email.</p>
        <p>Web conferencing details will be provided before the meeting.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;">
        <p style="font-size: 12px; color: #666;">Powered by Team Booking</p>
      </div>
    `;

    await sendBrevoEmail({
      toEmail: booker_email,
      toName: booker_name,
      subject: `Confirmed: ${meetingTitle}`,
      htmlContent,
      icsContent,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-booking error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
