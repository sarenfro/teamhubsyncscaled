import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, UserPlus, ArrowRightLeft, Trash2, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TeamAdmin {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

interface TeamAdminManagerProps {
  teamId: string;
  currentUserId: string;
}

const TeamAdminManager = ({ teamId, currentUserId }: TeamAdminManagerProps) => {
  const [admins, setAdmins] = useState<TeamAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<TeamAdmin | null>(null);
  const [pendingRemove, setPendingRemove] = useState<TeamAdmin | null>(null);

  const currentUserRole = admins.find((a) => a.user_id === currentUserId)?.role;
  const isOwner = currentUserRole === "owner";

  const callApi = async (body: Record<string, string>) => {
    const session = (await supabase.auth.getSession()).data.session;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-team-admin`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ team_id: teamId, ...body }),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  };

  const loadAdmins = async () => {
    try {
      const json = await callApi({ action: "list" });
      setAdmins(json.admins || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, [teamId]);

  const handleAdd = async () => {
    if (!addEmail.trim()) return;
    setAdding(true);
    try {
      await callApi({ action: "add", email: addEmail.trim() });
      toast.success("Admin added!");
      setAddEmail("");
      await loadAdmins();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleTransfer = async (targetUserId: string) => {
    try {
      await callApi({ action: "transfer", target_user_id: targetUserId });
      toast.success("Ownership transferred!");
      await loadAdmins();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemove = async (targetUserId: string) => {
    try {
      await callApi({ action: "remove", target_user_id: targetUserId });
      toast.success("Admin removed");
      await loadAdmins();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading admins...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border p-6 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4" /> Team Admins
        </h2>

        <div className="space-y-2">
          {admins.map((admin) => (
            <div
              key={admin.user_id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                {admin.role === "owner" && <Crown className="h-4 w-4 text-amber-500 shrink-0" />}
                <span className="text-sm text-foreground truncate">{admin.email}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize shrink-0">
                  {admin.role}
                </span>
                {admin.user_id === currentUserId && (
                  <span className="text-xs text-muted-foreground">(you)</span>
                )}
              </div>
              {isOwner && admin.user_id !== currentUserId && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Transfer ownership"
                    onClick={() => setPendingTransfer(admin)}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Remove admin"
                    onClick={() => setPendingRemove(admin)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {isOwner && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground">Add a new admin by their account email:</p>
            <div className="flex gap-2">
              <Input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="user@example.com"
                type="email"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button
                variant="booking"
                onClick={handleAdd}
                disabled={adding || !addEmail.trim()}
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Add
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Transfer confirmation */}
      <AlertDialog open={!!pendingTransfer} onOpenChange={(o) => !o && setPendingTransfer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              This will make <strong>{pendingTransfer?.email}</strong> the owner of this team. You will be demoted to admin. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTransfer) handleTransfer(pendingTransfer.user_id);
                setPendingTransfer(null);
              }}
            >
              Transfer Ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove confirmation */}
      <AlertDialog open={!!pendingRemove} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Admin?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingRemove?.email}</strong> will no longer be able to manage this team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRemove) handleRemove(pendingRemove.user_id);
                setPendingRemove(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TeamAdminManager;
