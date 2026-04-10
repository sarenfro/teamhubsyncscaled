import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    const dateStr = url.searchParams.get("date");

    if (!userId || !dateStr) {
      return new Response(JSON.stringify({ error: "Missing user_id or date" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get user's Google Calendar token
    const { data: tokenRow } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!tokenRow) {
      // No Google Calendar connected — return empty busy times
      return new Response(JSON.stringify({ busy_times: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = tokenRow.access_token;

    // Check if token is expired
    if (new Date(tokenRow.token_expires_at) <= new Date()) {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      if (!refreshed) {
        // Token refresh failed — return empty
        return new Response(JSON.stringify({ busy_times: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      accessToken = refreshed.access_token;
      const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase
        .from("google_calendar_tokens")
        .update({ access_token: accessToken, token_expires_at: newExpires })
        .eq("user_id", userId);
    }

    // Get user's timezone from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("user_id", userId)
      .maybeSingle();

    const timezone = profile?.timezone || "America/Los_Angeles";

    // Query Google Calendar FreeBusy API
    const timeMin = `${dateStr}T00:00:00`;
    const timeMax = `${dateStr}T23:59:59`;

    // Use freebusy query
    const freeBusyRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: new Date(`${dateStr}T00:00:00`).toISOString(),
        timeMax: new Date(`${dateStr}T23:59:59`).toISOString(),
        timeZone: timezone,
        items: [{ id: tokenRow.calendar_id || "primary" }],
      }),
    });

    if (!freeBusyRes.ok) {
      console.error("Google Calendar API error:", await freeBusyRes.text());
      return new Response(JSON.stringify({ busy_times: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const freeBusyData = await freeBusyRes.json();
    const calendarId = tokenRow.calendar_id || "primary";
    const busySlots = freeBusyData.calendars?.[calendarId]?.busy || [];

    // Convert to simple format: [{start: "HH:MM", end: "HH:MM"}]
    const busyTimes = busySlots.map((slot: { start: string; end: string }) => {
      const start = new Date(slot.start);
      const end = new Date(slot.end);
      // Format to HH:MM in user's timezone
      const fmt = (d: Date) => {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(d);
        const p: Record<string, string> = {};
        parts.forEach(({ type, value }) => { if (type !== "literal") p[type] = value; });
        return `${p.hour}:${p.minute}`;
      };
      return { start: fmt(start), end: fmt(end) };
    });

    return new Response(JSON.stringify({ busy_times: busyTimes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("google-calendar-busy error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
