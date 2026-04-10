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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to verify identity
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, team_id, email, target_user_id, role } = await req.json();
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is owner of this team
    const { data: callerAdmin } = await adminClient
      .from("team_admins")
      .select("role")
      .eq("team_id", team_id)
      .eq("user_id", user.id)
      .single();

    if (!callerAdmin || callerAdmin.role !== "owner") {
      return new Response(JSON.stringify({ error: "Only team owners can manage admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "add") {
      // Look up user by email
      const { data: { users }, error: lookupError } = await adminClient.auth.admin.listUsers();
      if (lookupError) throw lookupError;
      const targetUser = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!targetUser) {
        return new Response(JSON.stringify({ error: "No account found with that email" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already admin
      const { data: existing } = await adminClient
        .from("team_admins")
        .select("id")
        .eq("team_id", team_id)
        .eq("user_id", targetUser.id)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "User is already an admin of this team" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: insertError } = await adminClient
        .from("team_admins")
        .insert({ team_id, user_id: targetUser.id, role: "admin" });

      if (insertError) throw insertError;

      return new Response(JSON.stringify({ success: true, user_id: targetUser.id, email: targetUser.email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "transfer") {
      // Transfer ownership to target_user_id
      // Verify target is already an admin
      const { data: targetAdmin } = await adminClient
        .from("team_admins")
        .select("id, role")
        .eq("team_id", team_id)
        .eq("user_id", target_user_id)
        .single();

      if (!targetAdmin) {
        return new Response(JSON.stringify({ error: "Target user is not an admin of this team" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Promote target to owner
      await adminClient
        .from("team_admins")
        .update({ role: "owner" })
        .eq("team_id", team_id)
        .eq("user_id", target_user_id);

      // Demote caller to admin
      await adminClient
        .from("team_admins")
        .update({ role: "admin" })
        .eq("team_id", team_id)
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove") {
      // Remove an admin (not the owner themselves)
      if (target_user_id === user.id) {
        return new Response(JSON.stringify({ error: "Cannot remove yourself. Transfer ownership first." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient
        .from("team_admins")
        .delete()
        .eq("team_id", team_id)
        .eq("user_id", target_user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      // List all admins with emails
      const { data: admins } = await adminClient
        .from("team_admins")
        .select("user_id, role, created_at")
        .eq("team_id", team_id);

      if (!admins) {
        return new Response(JSON.stringify({ admins: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get emails from auth
      const { data: { users } } = await adminClient.auth.admin.listUsers();
      const userMap = new Map(users.map((u) => [u.id, u.email]));

      const enriched = admins.map((a) => ({
        user_id: a.user_id,
        role: a.role,
        email: userMap.get(a.user_id) || "unknown",
        created_at: a.created_at,
      }));

      return new Response(JSON.stringify({ admins: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
