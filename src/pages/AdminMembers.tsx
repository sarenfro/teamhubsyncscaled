import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Plus, Trash2, HelpCircle, AlertTriangle, CheckCircle, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface Member {
  id: string;
  name: string;
  email: string | null;
  ical_url: string | null;
  is_active: boolean;
  color_index: number;
}

interface IcalStatus {
  status: "ok" | "warning" | "error" | "loading";
  message: string;
}

const AdminMembers = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [icalInputs, setIcalInputs] = useState<Record<string, string>>({});
  const [nameInputs, setNameInputs] = useState<Record<string, string>>({});
  const [emailInputs, setEmailInputs] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [icalStatuses, setIcalStatuses] = useState<Record<string, IcalStatus>>({});
  const [gcalConnected, setGcalConnected] = useState<Record<string, boolean>>({});
  const [connectingGcal, setConnectingGcal] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;

    const load = async () => {
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .eq("slug", slug!)
        .maybeSingle();
      if (!team) return;
      setTeamId(team.id);

      const { data: mData } = await supabase
        .from("team_members")
        .select("id, name, email, ical_url, is_active, color_index")
        .eq("team_id", team.id)
        .order("created_at");
      if (mData) {
        setMembers(mData);
        const ic: Record<string, string> = {};
        const nm: Record<string, string> = {};
        const em: Record<string, string> = {};
        mData.forEach((m) => {
          ic[m.id] = m.ical_url ?? "";
          nm[m.id] = m.name;
          em[m.id] = m.email ?? "";
        });
        setIcalInputs(ic);
        setNameInputs(nm);
        setEmailInputs(em);

        // Check Google Calendar connections for all members
        const memberIds = mData.map((m) => m.id);
        const { data: gcalTokens } = await supabase
          .from("google_calendar_tokens")
          .select("team_member_id")
          .in("team_member_id", memberIds);

        if (gcalTokens) {
          const connected: Record<string, boolean> = {};
          gcalTokens.forEach((t) => {
            if (t.team_member_id) connected[t.team_member_id] = true;
          });
          setGcalConnected(connected);
        }

        // Auto-validate iCal feeds
        for (const m of mData) {
          if (m.ical_url) {
            validateIcalFeed(m.id, m.ical_url);
          }
        }
      }
    };
    load();
  }, [slug, user, authLoading]);

  const validateIcalFeed = async (memberId: string, url: string) => {
    if (!url) return;
    setIcalStatuses((prev) => ({ ...prev, [memberId]: { status: "loading", message: "Checking feed..." } }));
    try {
      const { data, error } = await supabase.functions.invoke("validate-ical", {
        body: { ical_url: url },
      });
      if (error) {
        setIcalStatuses((prev) => ({
          ...prev,
          [memberId]: { status: "error", message: "Could not validate the feed." },
        }));
      } else {
        setIcalStatuses((prev) => ({
          ...prev,
          [memberId]: { status: data.status, message: data.message },
        }));
      }
    } catch {
      setIcalStatuses((prev) => ({
        ...prev,
        [memberId]: { status: "error", message: "Validation failed." },
      }));
    }
  };

  const handleConnectGoogleCalendar = async (memberId: string) => {
    setConnectingGcal(memberId);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
        body: {
          redirect_uri: window.location.href,
          team_member_id: memberId,
        },
      });
      if (error || !data?.url) {
        toast.error("Could not start Google Calendar connection. Please try again.");
      } else {
        window.location.href = data.url;
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setConnectingGcal(null);
  };

  const handleSave = async (member: Member) => {
    setSavingId(member.id);
    const { error } = await supabase
      .from("team_members")
      .update({
        name: nameInputs[member.id] || member.name,
        email: emailInputs[member.id] || null,
        ical_url: icalInputs[member.id] || null,
      })
      .eq("id", member.id);
    if (error) {
      toast.error("Couldn't save changes. Please check your inputs and try again.");
      console.error("Save error:", error);
    } else {
      toast.success("Member updated successfully!");
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, name: nameInputs[member.id] || m.name, email: emailInputs[member.id] || null, ical_url: icalInputs[member.id] || null }
            : m,
        ),
      );
      // Re-validate iCal after save
      const newUrl = icalInputs[member.id];
      if (newUrl) {
        validateIcalFeed(member.id, newUrl);
      } else {
        setIcalStatuses((prev) => {
          const next = { ...prev };
          delete next[member.id];
          return next;
        });
      }
    }
    setSavingId(null);
  };

  const handleToggle = async (memberId: string, current: boolean) => {
    const { error } = await supabase
      .from("team_members")
      .update({ is_active: !current })
      .eq("id", memberId);
    if (error) {
      toast.error("Couldn't update member status. Please try again.");
    } else {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, is_active: !current } : m)),
      );
      toast.success(!current ? "Member activated" : "Member deactivated");
    }
  };

  const handleDelete = async (memberId: string) => {
    if (!confirm("Remove this member?")) return;
    const { error } = await supabase.from("team_members").delete().eq("id", memberId);
    if (error) {
      toast.error("Couldn't remove member. Please try again.");
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success("Member removed");
    }
  };

  const handleAddMember = async () => {
    if (!newName.trim() || !teamId) return;
    setAddingMember(true);
    const colorIndex = members.length % 4;
    const { data, error } = await supabase
      .from("team_members")
      .insert({ team_id: teamId, name: newName.trim(), color_index: colorIndex })
      .select()
      .single();
    if (error) {
      toast.error("Couldn't add member. Please try again.");
    } else if (data) {
      setMembers((prev) => [...prev, data]);
      setIcalInputs((prev) => ({ ...prev, [data.id]: "" }));
      setNameInputs((prev) => ({ ...prev, [data.id]: data.name }));
      setEmailInputs((prev) => ({ ...prev, [data.id]: "" }));
      setNewName("");
      toast.success("Member added!");
    }
    setAddingMember(false);
  };

  const renderIcalStatus = (memberId: string) => {
    const status = icalStatuses[memberId];
    if (!status) return null;

    if (status.status === "loading") {
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Checking calendar feed...</span>
        </div>
      );
    }

    if (status.status === "ok") {
      return (
        <div className="flex items-center gap-1.5 text-xs text-green-600 mt-1">
          <CheckCircle className="h-3 w-3" />
          <span>{status.message}</span>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-1.5 text-xs text-amber-600 mt-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-2">
        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
        <span>{status.message}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/admin/${slug}`}>
            <ChevronLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>

        <h1 className="text-2xl font-bold text-foreground">Manage Members</h1>

        <div className="space-y-4">
          {members.map((member) => (
            <div key={member.id} className="rounded-xl border border-border p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Input
                  value={nameInputs[member.id] ?? member.name}
                  onChange={(e) =>
                    setNameInputs((prev) => ({ ...prev, [member.id]: e.target.value }))
                  }
                  className="max-w-xs font-medium"
                />
                <div className="flex items-center gap-2">
                  <Switch
                    checked={member.is_active}
                    onCheckedChange={() => handleToggle(member.id, member.is_active)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {member.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(member.id)}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                value={emailInputs[member.id] ?? ""}
                onChange={(e) =>
                  setEmailInputs((prev) => ({ ...prev, [member.id]: e.target.value }))
                }
                placeholder="Member email address"
                type="email"
                className="text-sm"
              />

              {/* Calendar Integration Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-muted-foreground">Calendar Integration</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground transition-colors">
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 text-sm space-y-3" side="top">
                        <p className="font-semibold">Calendar Integration Options</p>
                        <div className="space-y-2">
                          <div>
                            <p className="font-medium text-foreground">Option 1: Google Calendar (Recommended)</p>
                            <p className="text-muted-foreground text-xs">
                              Connect directly with Google Calendar for the most reliable, real-time availability checking.
                            </p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Option 2: iCal URL</p>
                            <p className="text-muted-foreground text-xs mb-1">
                              Paste an iCal subscription URL from any calendar app. Note: some providers may not include all events.
                            </p>
                            <div>
                              <p className="font-medium text-foreground text-xs">Google Calendar</p>
                              <ol className="list-decimal list-inside text-muted-foreground space-y-0.5 text-xs">
                                <li>Open Google Calendar on the web</li>
                                <li>Click the ⋮ menu next to the calendar name</li>
                                <li>Select <strong>Settings and sharing</strong></li>
                                <li>Scroll to <strong>Integrate calendar</strong></li>
                                <li>Copy the <strong>Secret address in iCal format</strong></li>
                              </ol>
                            </div>
                            <div className="mt-1">
                              <p className="font-medium text-foreground text-xs">Outlook / Microsoft 365</p>
                              <ol className="list-decimal list-inside text-muted-foreground space-y-0.5 text-xs">
                                <li>Open Outlook Calendar on the web</li>
                                <li>Click ⚙️ → <strong>View all Outlook settings</strong></li>
                                <li>Go to <strong>Calendar → Shared calendars</strong></li>
                                <li>Under <strong>Publish a calendar</strong>, select your calendar</li>
                                <li>Click <strong>Publish</strong> and copy the <strong>ICS</strong> link</li>
                              </ol>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {gcalConnected[member.id] && (
                    <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/20">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Google Calendar Connected
                    </Badge>
                  )}
                </div>

                {/* Google Calendar Connect Button */}
                {!gcalConnected[member.id] && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => handleConnectGoogleCalendar(member.id)}
                    disabled={connectingGcal === member.id}
                  >
                    {connectingGcal === member.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Calendar className="h-4 w-4" />
                    )}
                    Connect Google Calendar (Recommended)
                  </Button>
                )}

                {/* iCal URL input */}
                <div className="flex gap-2">
                  <Input
                    value={icalInputs[member.id] ?? ""}
                    onChange={(e) =>
                      setIcalInputs((prev) => ({ ...prev, [member.id]: e.target.value }))
                    }
                    placeholder="Or paste iCal URL here"
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSave(member)}
                    disabled={savingId === member.id}
                  >
                    {savingId === member.id ? "Saving..." : "Save"}
                  </Button>
                </div>

                {/* iCal status indicator */}
                {renderIcalStatus(member.id)}
              </div>
            </div>
          ))}
        </div>

        {/* Add member */}
        <div className="rounded-xl border border-dashed border-border p-5 space-y-3">
          <h3 className="font-medium text-foreground">Add Member</h3>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New member name"
              onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
            />
            <Button
              variant="booking"
              onClick={handleAddMember}
              disabled={addingMember || !newName.trim()}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMembers;
