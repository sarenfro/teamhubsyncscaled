import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEZONE = "America/Los_Angeles";

// Map Windows / non-IANA timezone names to IANA identifiers
const TIMEZONE_MAP: Record<string, string> = {
  "Pacific Standard Time": "America/Los_Angeles",
  "Pacific Daylight Time": "America/Los_Angeles",
  "Mountain Standard Time": "America/Denver",
  "Mountain Daylight Time": "America/Denver",
  "US Mountain Standard Time": "America/Phoenix",
  "Central Standard Time": "America/Chicago",
  "Central Daylight Time": "America/Chicago",
  "Eastern Standard Time": "America/New_York",
  "Eastern Daylight Time": "America/New_York",
  "US Eastern Standard Time": "America/Indianapolis",
  "Atlantic Standard Time": "Atlantic/Bermuda",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "Alaskan Standard Time": "America/Anchorage",
  "SA Pacific Standard Time": "America/Bogota",
  "SA Western Standard Time": "America/La_Paz",
  "SA Eastern Standard Time": "America/Cayenne",
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "W. Europe Standard Time": "Europe/Berlin",
  "Central European Standard Time": "Europe/Warsaw",
  "Romance Standard Time": "Europe/Paris",
  "E. Europe Standard Time": "Europe/Chisinau",
  "FLE Standard Time": "Europe/Kiev",
  "GTB Standard Time": "Europe/Bucharest",
  "Russian Standard Time": "Europe/Moscow",
  "Israel Standard Time": "Asia/Jerusalem",
  "South Africa Standard Time": "Africa/Johannesburg",
  "India Standard Time": "Asia/Kolkata",
  "China Standard Time": "Asia/Shanghai",
  "Tokyo Standard Time": "Asia/Tokyo",
  "Korea Standard Time": "Asia/Seoul",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "New Zealand Standard Time": "Pacific/Auckland",
  "Taipei Standard Time": "Asia/Taipei",
  "Singapore Standard Time": "Asia/Singapore",
  "Arabian Standard Time": "Asia/Dubai",
  "SE Asia Standard Time": "Asia/Bangkok",
  "Customized Time Zone": "America/Los_Angeles",
};

function normalizeTimezone(tzid: string): string {
  // Strip surrounding quotes
  const cleaned = tzid.replace(/^["']|["']$/g, "").trim();
  // Common valid names
  if (cleaned === "UTC" || cleaned === "GMT") return "Etc/UTC";
  // Already valid IANA?
  if (cleaned.includes("/")) return cleaned;
  // Look up in our map (case-insensitive)
  const mapped = TIMEZONE_MAP[cleaned] ||
    Object.entries(TIMEZONE_MAP).find(
      ([k]) => k.toLowerCase() === cleaned.toLowerCase(),
    )?.[1];
  if (mapped) return mapped;
  // Last resort
  console.warn(`Unknown timezone: ${cleaned}, falling back to ${TIMEZONE}`);
  return TIMEZONE;
}

// Convert a local Seattle time on a given date to UTC
function seattleToUTC(dateStr: string, hours: number, minutes: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Try PDT (UTC-7) then PST (UTC-8) — pick whichever round-trips correctly
  for (const offsetHours of [7, 8]) {
    const utcDate = new Date(Date.UTC(y, m - 1, d, hours + offsetHours, minutes));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(utcDate);
    const p: Record<string, number> = {};
    parts.forEach(({ type, value }) => {
      if (type !== "literal") p[type] = parseInt(value);
    });
    if (
      p.year === y &&
      p.month === m &&
      p.day === d &&
      p.hour % 24 === hours &&
      p.minute === minutes
    ) {
      return utcDate;
    }
  }
  // Fallback: assume PST
  return new Date(Date.UTC(y, m - 1, d, hours + 8, minutes));
}

// Format a UTC Date as "h:mm am/pm" in Seattle timezone
function formatSeattleTime(utcDate: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(utcDate)
    .toLowerCase();
}

// Get Seattle date/time components from a UTC date
function getSeattleParts(
  utcDate: Date,
): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(utcDate);
  const p: Record<string, string> = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: parseInt(p.year),
    month: parseInt(p.month),
    day: parseInt(p.day),
    hour: parseInt(p.hour) % 24,
    minute: parseInt(p.minute),
    weekday: weekdays.indexOf(p.weekday),
  };
}

// Parse a DTSTART or DTEND property line to a UTC Date
// Handles: DTSTART:20240115T090000Z, DTSTART;TZID=...:20240115T090000, DTSTART;VALUE=DATE:20240115
function parseDtProp(propLine: string): { date: Date; isAllDay: boolean } | null {
  const colonIdx = propLine.lastIndexOf(":");
  if (colonIdx === -1) return null;
  const params = propLine.slice(0, colonIdx).toUpperCase();
  const value = propLine.slice(colonIdx + 1).trim();

  // All-day
  if (params.includes("VALUE=DATE") || /^\d{8}$/.test(value)) {
    const m = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return null;
    return {
      date: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])),
      isAllDay: true,
    };
  }

  // Datetime
  const dm = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!dm) return null;
  const [, y, mo, d, h, mi, , utcFlag] = dm;

  if (utcFlag === "Z") {
    return {
      date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)),
      isAllDay: false,
    };
  }

  // Extract TZID from original (non-uppercased) propLine
  const tzidMatch = propLine.match(/TZID=([^;:]+)/i);
  const rawTzid = tzidMatch ? tzidMatch[1] : TIMEZONE;
  const tzid = normalizeTimezone(rawTzid);

  // Convert from tzid to UTC by round-trip
  for (const offsetHours of [7, 8, 0, 5, 6, 9, 10, 1, -1, 2, 3, 4, 11, 12, -5, -6, -7, -8]) {
    const utcDate = new Date(Date.UTC(+y, +mo - 1, +d, +h + offsetHours, +mi));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tzid,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(utcDate);
    const p: Record<string, number> = {};
    parts.forEach(({ type, value: v }) => {
      if (type !== "literal") p[type] = parseInt(v);
    });
    if (
      p.year === +y &&
      p.month === +mo &&
      p.day === +d &&
      p.hour % 24 === +h &&
      p.minute === +mi
    ) {
      return { date: utcDate, isAllDay: false };
    }
  }

  // Fallback: treat as Seattle local time
  return {
    date: seattleToUTC(`${y}-${mo}-${d}`, +h, +mi),
    isAllDay: false,
  };
}

interface CalEvent {
  start: Date;
  end: Date;
  isAllDay: boolean;
}

// Check if a recurring rule makes the event fall on targetDayStart (UTC midnight Seattle)
function doesRecurOnDate(
  dtstart: Date,
  rrule: string,
  targetDateStr: string,
): boolean {
  const [ty, tm, td] = targetDateStr.split("-").map(Number);
  const targetDayUTC = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0)); // noon UTC avoids DST edge cases

  const freqMatch = rrule.match(/FREQ=(\w+)/i);
  if (!freqMatch) return false;
  const freq = freqMatch[1].toUpperCase();

  // UNTIL check
  const untilMatch = rrule.match(/UNTIL=(\d{8}(?:T\d{6}Z?)?)/i);
  if (untilMatch) {
    const us = untilMatch[1];
    let untilDate: Date;
    if (us.length === 8) {
      untilDate = new Date(Date.UTC(+us.slice(0, 4), +us.slice(4, 6) - 1, +us.slice(6, 8)));
    } else {
      const ud = parseDtProp(`DTSTART:${us}`);
      if (!ud) return false;
      untilDate = ud.date;
    }
    if (targetDayUTC > untilDate) return false;
  }

  // Must be after or on start
  if (targetDayUTC < dtstart) return false;

  const startParts = getSeattleParts(dtstart);
  const targetParts = getSeattleParts(targetDayUTC);

  if (freq === "DAILY") {
    const intervalMatch = rrule.match(/INTERVAL=(\d+)/i);
    const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
    const daysDiff = Math.round(
      (targetDayUTC.getTime() - new Date(Date.UTC(
        startParts.year, startParts.month - 1, startParts.day,
      )).getTime()) / (24 * 60 * 60 * 1000),
    );
    return daysDiff >= 0 && daysDiff % interval === 0;
  }

  if (freq === "WEEKLY") {
    const intervalMatch = rrule.match(/INTERVAL=(\d+)/i);
    const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
    const dayMap: Record<string, number> = {
      SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
    };

    const bydayMatch = rrule.match(/BYDAY=([^;]+)/i);
    if (bydayMatch) {
      const days = bydayMatch[1]
        .split(",")
        .map((s) => dayMap[s.trim().slice(-2).toUpperCase()])
        .filter((d) => d !== undefined);
      if (!days.includes(targetParts.weekday)) return false;
    } else {
      if (targetParts.weekday !== startParts.weekday) return false;
    }

    // Check week interval
    const startDayUTC = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
    const targetDayOnly = new Date(Date.UTC(targetParts.year, targetParts.month - 1, targetParts.day));
    const weeksDiff = Math.round(
      (targetDayOnly.getTime() - startDayUTC.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    return weeksDiff >= 0 && weeksDiff % interval === 0;
  }

  return false;
}

// Parse an iCal string and return CalEvents that are busy on the given date
function parseIcalForDate(icalText: string, targetDateStr: string): CalEvent[] {
  const [ty, tm, td] = targetDateStr.split("-").map(Number);

  // Unfold lines (RFC 5545 §3.1)
  const unfolded = icalText
    .replace(/\r\n[ \t]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .replace(/\r/g, "\n");

  const lines = unfolded.split("\n");
  const events: CalEvent[] = [];

  let inEvent = false;
  let dtstart: Date | null = null;
  let dtend: Date | null = null;
  let isAllDay = false;
  let rrule: string | null = null;
  const exdates: Date[] = [];

  for (const line of lines) {
    if (line.trim() === "BEGIN:VEVENT") {
      inEvent = true;
      dtstart = null;
      dtend = null;
      isAllDay = false;
      rrule = null;
      exdates.length = 0;
    } else if (line.trim() === "END:VEVENT") {
      if (inEvent && dtstart && dtend) {
        const startParts = getSeattleParts(dtstart);
        const isOnTarget =
          startParts.year === ty && startParts.month === tm && startParts.day === td;

        let shouldInclude = false;

        if (isAllDay) {
          // All-day event covers the target date if start <= target < end
          const targetUtcMidnight = new Date(Date.UTC(ty, tm - 1, td));
          shouldInclude = targetUtcMidnight >= dtstart && targetUtcMidnight < dtend;
          if (!shouldInclude && rrule) {
            shouldInclude = doesRecurOnDate(dtstart, rrule, targetDateStr);
          }
        } else {
          shouldInclude = isOnTarget;
          if (!shouldInclude && rrule) {
            shouldInclude = doesRecurOnDate(dtstart, rrule, targetDateStr);
          }
        }

        if (shouldInclude) {
          // Check exdates
          const excluded = exdates.some((ex) => {
            const exParts = getSeattleParts(ex);
            return exParts.year === ty && exParts.month === tm && exParts.day === td;
          });

          if (!excluded) {
            if (isAllDay) {
              // Block entire target day
              events.push({
                start: seattleToUTC(targetDateStr, 0, 0),
                end: seattleToUTC(targetDateStr, 23, 59),
                isAllDay: true,
              });
            } else if (rrule && !isOnTarget) {
              // Recurring: reconstruct event on target date with same time
              const duration = dtend.getTime() - dtstart.getTime();
              const newStart = seattleToUTC(
                targetDateStr,
                startParts.hour,
                startParts.minute,
              );
              events.push({
                start: newStart,
                end: new Date(newStart.getTime() + duration),
                isAllDay: false,
              });
            } else {
              events.push({ start: dtstart, end: dtend, isAllDay: false });
            }
          }
        }
      }
      inEvent = false;
    } else if (inEvent) {
      const upperLine = line.toUpperCase();

      if (upperLine.startsWith("DTSTART")) {
        const result = parseDtProp(line);
        if (result) {
          dtstart = result.date;
          isAllDay = result.isAllDay;
        }
      } else if (upperLine.startsWith("DTEND")) {
        const result = parseDtProp(line);
        if (result) dtend = result.date;
      } else if (upperLine.startsWith("DURATION:") && dtstart && !dtend) {
        // Parse DURATION as fallback for DTEND
        const dMatch = line.match(/DURATION:P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/i);
        if (dMatch) {
          const weeks = parseInt(dMatch[1] || "0");
          const days = parseInt(dMatch[2] || "0");
          const hours = parseInt(dMatch[3] || "0");
          const mins = parseInt(dMatch[4] || "0");
          const durationMs = ((weeks * 7 + days) * 24 * 60 + hours * 60 + mins) * 60 * 1000;
          dtend = new Date(dtstart.getTime() + durationMs);
        }
      } else if (upperLine.startsWith("RRULE:")) {
        rrule = line.slice(6);
      } else if (upperLine.startsWith("EXDATE")) {
        const result = parseDtProp(line);
        if (result) exdates.push(result.date);
      }
    }
  }

  return events;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const dateStr = url.searchParams.get("date");
    const memberIdsParam = url.searchParams.get("member_ids");

    if (!dateStr || !memberIdsParam) {
      return new Response(JSON.stringify({ error: "Missing date or member_ids" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memberIds = memberIdsParam.split(",").map((s) => s.trim()).filter(Boolean);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch members with their iCal URLs
    const { data: members } = await supabase
      .from("team_members")
      .select("id, name, ical_url")
      .in("id", memberIds);

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ available_times: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify target date is a weekday in Seattle
    const [ty, tm, td] = dateStr.split("-").map(Number);
    const targetNoon = new Date(Date.UTC(ty, tm - 1, td, 20, 0, 0)); // ~noon PST
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      weekday: "short",
    }).format(targetNoon);

    if (weekday === "Sat" || weekday === "Sun") {
      return new Response(JSON.stringify({ available_times: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate 30-min slots: 9:00am–4:30pm Seattle time
    const slots: { start: Date; end: Date; label: string }[] = [];
    for (let h = 9; h <= 16; h++) {
      for (const m of [0, 30]) {
        if (h === 17) break;
        const start = seattleToUTC(dateStr, h, m);
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        slots.push({ start, end, label: formatSeattleTime(start) });
      }
    }

    // Collect busy periods from all members' iCal feeds AND Google Calendar
    const busyPeriods: { start: Date; end: Date }[] = [];
    // Per-member busy periods for daily timeline view
    const memberBusyMap: Record<string, { start: string; end: string }[]> = {};
    for (const m of members) memberBusyMap[m.id] = [];

    // Also fetch Google Calendar tokens for these members
    const { data: gcalTokens } = await supabase
      .from("google_calendar_tokens")
      .select("team_member_id, access_token, refresh_token, token_expires_at, calendar_id")
      .in("team_member_id", memberIds);

    const gcalTokenMap = new Map<string, typeof gcalTokens extends (infer T)[] | null ? T : never>();
    if (gcalTokens) {
      for (const t of gcalTokens) {
        if (t.team_member_id) gcalTokenMap.set(t.team_member_id, t);
      }
    }

    await Promise.all(
      members.map(async (member) => {
        // Check iCal feed
        const icalUrl = member.ical_url;
        if (icalUrl) {
          try {
            const response = await fetch(icalUrl, {
              headers: { "User-Agent": "TeamBooking/1.0" },
              signal: AbortSignal.timeout(8000),
            });
            if (!response.ok) {
              console.error(`iCal fetch returned ${response.status} for member ${member.name}`);
            } else {
              const icalText = await response.text();
              const events = parseIcalForDate(icalText, dateStr);
              if (events.length === 0) {
                const eventCount = (icalText.match(/BEGIN:VEVENT/g) || []).length;
                console.warn(`No busy events for ${member.name} on ${dateStr} (feed has ${eventCount} events total)`);
              }
              busyPeriods.push(...events.map((e) => ({ start: e.start, end: e.end })));
              for (const e of events) {
                memberBusyMap[member.id].push({
                  start: e.start.toISOString(),
                  end: e.end.toISOString(),
                });
              }
            }
          } catch (e) {
            console.error(`iCal fetch failed for member ${member.name}:`, e);
          }
        }

        // Check Google Calendar
        const gcalToken = gcalTokenMap.get(member.id);
        if (gcalToken) {
          try {
            let accessToken = gcalToken.access_token;

            // Refresh if expired
            if (new Date(gcalToken.token_expires_at) <= new Date()) {
              const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
                  client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
                  refresh_token: gcalToken.refresh_token,
                  grant_type: "refresh_token",
                }),
              });
              if (refreshRes.ok) {
                const refreshed = await refreshRes.json();
                accessToken = refreshed.access_token;
                const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
                await supabase
                  .from("google_calendar_tokens")
                  .update({ access_token: accessToken, token_expires_at: newExpires })
                  .eq("team_member_id", member.id);
              } else {
                console.error(`Google token refresh failed for ${member.name}`);
                return;
              }
            }

            // Query Google Calendar FreeBusy API
            const freeBusyRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                timeMin: new Date(`${dateStr}T00:00:00`).toISOString(),
                timeMax: new Date(`${dateStr}T23:59:59`).toISOString(),
                timeZone: TIMEZONE,
                items: [{ id: gcalToken.calendar_id || "primary" }],
              }),
            });

            if (freeBusyRes.ok) {
              const freeBusyData = await freeBusyRes.json();
              const calendarId = gcalToken.calendar_id || "primary";
              const busySlots = freeBusyData.calendars?.[calendarId]?.busy || [];
              for (const slot of busySlots) {
                const s = new Date(slot.start);
                const e = new Date(slot.end);
                busyPeriods.push({ start: s, end: e });
                memberBusyMap[member.id].push({
                  start: s.toISOString(),
                  end: e.toISOString(),
                });
              }
              console.log(`Google Calendar: ${busySlots.length} busy slots for ${member.name}`);
            } else {
              console.error(`Google Calendar API error for ${member.name}:`, await freeBusyRes.text());
            }
          } catch (e) {
            console.error(`Google Calendar check failed for ${member.name}:`, e);
          }
        }
      }),
    );

    const now = new Date();

    const availableTimes = slots
      .filter((slot) => {
        if (slot.start <= now) return false;
        return !busyPeriods.some(
          (busy) => slot.start < busy.end && slot.end > busy.start,
        );
      })
      .map((slot) => slot.label);

    const memberBusy = members.map((m) => ({
      id: m.id,
      name: m.name,
      busy: memberBusyMap[m.id] ?? [],
    }));

    return new Response(
      JSON.stringify({ available_times: availableTimes, member_busy: memberBusy }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("get-availability error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
