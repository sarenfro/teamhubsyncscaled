const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ORGANIZER_EMAIL = "uwmbaacalendar@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { booker_name, booker_email, meeting_date, meeting_time, duration_minutes, team_member_name, notes } = await req.json();

    if (!booker_name || !booker_email || !meeting_date || !meeting_time) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { hours: startH, minutes: startM } = parse12To24(meeting_time);
    const dur = duration_minutes || 30;
    const endTotalMins = startH * 60 + startM + dur;
    const endH = Math.floor(endTotalMins / 60);
    const endM = endTotalMins % 60;

    const dateCompact = meeting_date.replace(/-/g, "");
    const start = `${dateCompact}T${pad(startH)}${pad(startM)}00`;
    const end = `${dateCompact}T${pad(endH)}${pad(endM)}00`;

    const uid = crypto.randomUUID();
    const now = formatICSDate(new Date());

    const summary = team_member_name
      ? `Meeting with ${team_member_name}`
      : "Team Meeting";

    const description = notes ? notes.replace(/\n/g, "\\n") : "";

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Team Scheduler//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VTIMEZONE",
      "TZID:America/Los_Angeles",
      "BEGIN:STANDARD",
      "DTSTART:19701101T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
      "TZOFFSETFROM:-0700",
      "TZOFFSETTO:-0800",
      "TZNAME:PST",
      "END:STANDARD",
      "BEGIN:DAYLIGHT",
      "DTSTART:19700308T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
      "TZOFFSETFROM:-0800",
      "TZOFFSETTO:-0700",
      "TZNAME:PDT",
      "END:DAYLIGHT",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=America/Los_Angeles:${start}`,
      `DTEND;TZID=America/Los_Angeles:${end}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `ORGANIZER;CN=Team Scheduler:mailto:${ORGANIZER_EMAIL}`,
      `ATTENDEE;CN=${booker_name};RSVP=TRUE:mailto:${booker_email}`,
      `ATTENDEE;CN=Team Calendar;RSVP=TRUE:mailto:${ORGANIZER_EMAIL}`,
      "STATUS:CONFIRMED",
      "SEQUENCE:0",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(
      JSON.stringify({ ics, filename: `meeting-${meeting_date}.ics` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error generating ICS:", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate calendar file" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parse12To24(time12: string): { hours: number; minutes: number } {
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return { hours: 9, minutes: 0 };
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toLowerCase();
  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  return { hours, minutes };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
