import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { compareSync } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the user from the JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify the JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { slug, password } = await req.json();

    if (!slug || !password) {
      return new Response(JSON.stringify({ error: "Missing slug or password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the team
    const { data: team } = await supabase
      .from("teams")
      .select("id, name, slug, password_hash")
      .eq("slug", slug)
      .maybeSingle();

    if (!team) {
      return new Response(JSON.stringify({ error: "Team not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the password
    const match = compareSync(password, team.password_hash);
    if (!match) {
      return new Response(JSON.stringify({ error: "Incorrect password" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already claimed by this user
    const { data: existing } = await supabase
      .from("team_admins")
      .select("id")
      .eq("user_id", user.id)
      .eq("team_id", team.id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "You already manage this team" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add as owner
    await supabase.from("team_admins").insert({
      user_id: user.id,
      team_id: team.id,
      role: "owner",
    });

    // Set created_by if not set
    await supabase
      .from("teams")
      .update({ created_by: user.id })
      .eq("id", team.id)
      .is("created_by", null);

    return new Response(
      JSON.stringify({ success: true, teamId: team.id, teamName: team.name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("claim-team error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
