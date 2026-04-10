import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Check, Loader2, Unlink } from "lucide-react";

const Integrations = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loadingState, setLoadingState] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await supabase
        .from("google_calendar_tokens")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      setGoogleConnected(!!data);
      setLoadingState(false);
    };
    check();
  }, [user]);

  const handleConnectGoogle = async () => {
    if (!user) return;
    setConnecting(true);
    try {
      const session = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({
            redirect_uri: `${window.location.origin}/integrations?google=connected`,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initiate Google auth");
      window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("google_calendar_tokens")
      .delete()
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setGoogleConnected(false);
      toast({ title: "Disconnected", description: "Google Calendar has been disconnected." });
    }
  };

  // Check URL params for success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") {
      setGoogleConnected(true);
      toast({ title: "Connected!", description: "Google Calendar is now linked." });
      window.history.replaceState({}, "", "/integrations");
    }
  }, []);

  if (loading || loadingState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-4" onClick={() => navigate("/dashboard")}>
            ← Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">Connect external services to enhance your booking experience.</p>
        </div>

        <div className="rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Google Calendar</h3>
              <p className="text-sm text-muted-foreground">
                Sync your calendar to automatically block busy times from bookings.
              </p>
            </div>
            {googleConnected ? (
              <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                <Check className="h-4 w-4" /> Connected
              </span>
            ) : null}
          </div>

          {googleConnected ? (
            <Button variant="outline" size="sm" onClick={handleDisconnect}>
              <Unlink className="h-4 w-4 mr-1" /> Disconnect
            </Button>
          ) : (
            <Button variant="booking" onClick={handleConnectGoogle} disabled={connecting}>
              {connecting ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Connecting...</>
              ) : (
                "Connect Google Calendar"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Integrations;
