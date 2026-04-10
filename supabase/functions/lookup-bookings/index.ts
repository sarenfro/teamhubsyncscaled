import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, booker_name, booker_email, meeting_date, meeting_time, duration_minutes, status, cancellation_token, team_member_id")
      .eq("booker_email", email.trim().toLowerCase())
      .order("meeting_date", { ascending: false })
      .limit(50);

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to look up bookings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch team member names
    const memberIds = [...new Set((bookings ?? []).map((b: { team_member_id: string | null }) => b.team_member_id).filter(Boolean))];
    let memberMap: Record<string, string> = {};
    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from("team_members")
        .select("id, name")
        .in("id", memberIds);
      memberMap = Object.fromEntries((members ?? []).map((m: { id: string; name: string }) => [m.id, m.name]));
    }

    const results = (bookings ?? []).map((b: any) => ({
      id: b.id,
      meeting_date: b.meeting_date,
      meeting_time: b.meeting_time,
      duration_minutes: b.duration_minutes,
      status: b.status,
      team_member_name: b.team_member_id ? memberMap[b.team_member_id] || "Team Member" : "Team",
      cancellation_token: b.status === "confirmed" ? b.cancellation_token : null,
    }));

    return new Response(JSON.stringify({ bookings: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("lookup-bookings error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
