import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashSync } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Try to get authenticated user (optional for backwards compat)
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    let userId: string | null = null;

    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    const { name, slug, password, members } = await req.json();

    if (!name || !slug || !Array.isArray(members) || members.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hash the password (kept for claiming flow)
    const passwordHash = password ? hashSync(password) : hashSync(crypto.randomUUID());

    // Insert team
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({ name, slug, password_hash: passwordHash, created_by: userId })
      .select()
      .single();

    if (teamError) {
      return new Response(JSON.stringify({ error: teamError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If user is authenticated, add them as owner
    if (userId) {
      await supabase.from("team_admins").insert({
        user_id: userId,
        team_id: team.id,
        role: "owner",
      });
    }

    // Insert team members
    type MemberInput = { name: string; email?: string; ical_url?: string; html_link?: string };
    const memberRows = (members as MemberInput[]).map((m, i) => ({
      team_id: team.id,
      name: m.name,
      email: m.email || null,
      ical_url: m.ical_url || null,
      html_link: m.html_link || null,
      color_index: i % 4,
    }));

    await supabase.from("team_members").insert(memberRows);

    return new Response(JSON.stringify({ teamId: team.id, slug: team.slug }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-team error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
