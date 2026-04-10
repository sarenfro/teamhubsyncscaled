import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ical_url } = await req.json();
    if (!ical_url) {
      return new Response(JSON.stringify({ error: "Missing ical_url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(ical_url, {
      headers: { "User-Agent": "TeamBooking/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({
        status: "error",
        message: "Could not reach the calendar feed. The URL may be invalid or expired.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = await response.text();
    const eventCount = (text.match(/BEGIN:VEVENT/g) || []).length;

    if (eventCount === 0) {
      return new Response(JSON.stringify({
        status: "warning",
        message: "This calendar feed has no events. It may be empty or the URL might not be correct.",
        event_count: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if any events are within 30 days of now
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Simple date extraction from DTSTART lines
    const dateMatches = text.match(/DTSTART[^:]*:(\d{8})/g) || [];
    let hasRecentEvent = false;

    for (const match of dateMatches) {
      const dateStr = match.match(/(\d{8})/)?.[1];
      if (!dateStr) continue;
      const y = parseInt(dateStr.slice(0, 4));
      const m = parseInt(dateStr.slice(4, 6)) - 1;
      const d = parseInt(dateStr.slice(6, 8));
      const eventDate = new Date(y, m, d);
      if (eventDate >= thirtyDaysAgo && eventDate <= thirtyDaysFromNow) {
        hasRecentEvent = true;
        break;
      }
    }

    if (!hasRecentEvent) {
      return new Response(JSON.stringify({
        status: "warning",
        message: `This feed has ${eventCount} events but none are recent. The calendar may not be syncing current events. Try re-publishing your calendar.`,
        event_count: eventCount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      status: "ok",
      message: `Calendar feed is working — ${eventCount} events found including recent ones.`,
      event_count: eventCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("validate-ical error:", err);
    return new Response(JSON.stringify({
      status: "error",
      message: "Failed to check the calendar feed. Please try again.",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
