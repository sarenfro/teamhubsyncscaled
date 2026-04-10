import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Users, LogOut, Key, Calendar, Clock, Link2, GitFork, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface TeamWithRole {
  team_id: string;
  role: string;
  team: { id: string; name: string; slug: string } | null;
}

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [teams, setTeams] = useState<TeamWithRole[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Claim team state
  const [showClaim, setShowClaim] = useState(false);
  const [claimSlug, setClaimSlug] = useState("");
  const [claimPassword, setClaimPassword] = useState("");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      // Check if profile has slug set (onboarding complete)
      const { data: profile } = await supabase
        .from("profiles")
        .select("slug")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.slug) {
        navigate("/onboarding");
        return;
      }

      const { data } = await supabase
        .from("team_admins")
        .select("team_id, role, team:team_id(id, name, slug)")
        .eq("user_id", user.id);
      if (data) setTeams(data as unknown as TeamWithRole[]);
      setLoadingTeams(false);
    };
    loadData();
  }, [user, navigate]);

  const reloadTeams = async () => {
    const { data } = await supabase
      .from("team_admins")
      .select("team_id, role, team:team_id(id, name, slug)")
      .eq("user_id", user!.id);
    if (data) setTeams(data as unknown as TeamWithRole[]);
  };

  const handleDeleteTeam = async (teamId: string) => {
    const { error } = await supabase.from("teams").delete().eq("id", teamId);
    if (error) {
      toast({ title: "Error", description: "Failed to delete team", variant: "destructive" });
    } else {
      toast({ title: "Team deleted" });
      await reloadTeams();
    }
  };

  const handleClaim = async () => {
    if (!claimSlug.trim() || !claimPassword.trim()) return;
    setClaiming(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claim-team`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ slug: claimSlug.trim(), password: claimPassword }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to claim team");
      toast({ title: "Team claimed!", description: `You now manage "${json.teamName}".` });
      setShowClaim(false);
      setClaimSlug("");
      setClaimPassword("");
      // Reload teams
      const { data } = await supabase
        .from("team_admins")
        .select("team_id, role, team:team_id(id, name, slug)")
        .eq("user_id", user!.id);
      if (data) setTeams(data as unknown as TeamWithRole[]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-1" /> Sign Out
          </Button>
        </div>

        {/* Personal event types */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" /> My Event Types
            </h2>
            <Button asChild variant="booking" size="sm">
              <Link to="/event-types">Manage</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Create and manage your personal meeting types.
          </p>
        </div>

        {/* Availability */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Availability
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link to="/availability">Set Hours</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure your weekly working hours for bookings.
          </p>
        </div>

        {/* Integrations */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Integrations
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link to="/integrations">Manage</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Connect Google Calendar and other services.
          </p>
        </div>

        {/* Routing Forms */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <GitFork className="h-4 w-4" /> Routing Forms
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link to="/routing-forms">Manage</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Pre-booking questions that route to the right event type.
          </p>
        </div>

        {loadingTeams ? (
          <p className="text-muted-foreground">Loading teams...</p>
        ) : teams.length === 0 ? (
          <div className="rounded-xl border border-border p-10 text-center space-y-4">
            <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">You don't have any teams yet.</p>
            <p className="text-sm text-muted-foreground">Create a new team or claim an existing one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map((t) => (
              <Link
                key={t.team_id}
                to={`/admin/${t.team?.slug}`}
                className="flex items-center justify-between rounded-xl border border-border p-5 hover:bg-accent/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-foreground">{t.team?.name}</p>
                  <p className="text-sm text-muted-foreground">/book/{t.team?.slug}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-booking-hero-light text-booking-hero font-medium capitalize">
                  {t.role}
                </span>
              </Link>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="booking" onClick={() => navigate("/create")} className="flex-1">
            <Plus className="h-4 w-4 mr-1" /> Create Team
          </Button>
          <Button variant="outline" onClick={() => setShowClaim(!showClaim)} className="flex-1">
            <Key className="h-4 w-4 mr-1" /> Claim Existing Team
          </Button>
        </div>

        {showClaim && (
          <div className="rounded-xl border border-border p-6 space-y-4">
            <h2 className="font-semibold text-foreground">Claim a Team</h2>
            <p className="text-sm text-muted-foreground">
              Enter the team slug and the original team password to claim ownership.
            </p>
            <Input
              value={claimSlug}
              onChange={(e) => setClaimSlug(e.target.value)}
              placeholder="Team slug (e.g. my-team)"
            />
            <Input
              type="password"
              value={claimPassword}
              onChange={(e) => setClaimPassword(e.target.value)}
              placeholder="Original team password"
            />
            <Button
              variant="booking"
              onClick={handleClaim}
              disabled={claiming || !claimSlug.trim() || !claimPassword.trim()}
              className="w-full"
            >
              {claiming ? "Claiming..." : "Claim Team"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
