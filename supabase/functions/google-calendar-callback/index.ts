import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(`<html><body><h2>Authorization failed</h2><p>${error}</p></body></html>`, {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (!code || !stateParam) {
      return new Response(`<html><body><h2>Missing parameters</h2></body></html>`, {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    const state = JSON.parse(atob(stateParam));
    const { user_id, redirect_uri, team_member_id } = state;

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("Token exchange failed:", tokens);
      return new Response(`<html><body><h2>Token exchange failed</h2><p>${tokens.error_description || tokens.error}</p></body></html>`, {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Build upsert record
    const tokenRecord: Record<string, unknown> = {
      user_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      calendar_id: "primary",
    };

    if (team_member_id) {
      tokenRecord.team_member_id = team_member_id;
    }

    // Upsert token record
    const { error: dbError } = await supabase
      .from("google_calendar_tokens")
      .upsert(tokenRecord, { onConflict: team_member_id ? "team_member_id" : "user_id" });

    if (dbError) {
      console.error("DB error:", dbError);
      return new Response(`<html><body><h2>Failed to save token</h2></body></html>`, {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Redirect back to app
    const returnUrl = redirect_uri || "/dashboard";
    return new Response(null, {
      status: 302,
      headers: { Location: returnUrl },
    });
  } catch (err) {
    console.error("google-calendar-callback error:", err);
    return new Response(`<html><body><h2>Server error</h2></body></html>`, {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
});
