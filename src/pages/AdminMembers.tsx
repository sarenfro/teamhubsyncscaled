import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Plus, Trash2, HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Member {
  id: string;
  name: string;
  email: string | null;
  ical_url: string | null;
  is_active: boolean;
  color_index: number;
}

const AdminMembers = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [icalInputs, setIcalInputs] = useState<Record<string, string>>({});
  const [nameInputs, setNameInputs] = useState<Record<string, string>>({});
  const [emailInputs, setEmailInputs] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(`team_auth_${slug}`);
    if (!token) { navigate(`/login/${slug}`); return; }
    try {
      const parsed = JSON.parse(token);
      if (!parsed.authorized) { navigate(`/login/${slug}`); return; }
    } catch {
      navigate(`/login/${slug}`);
      return;
    }

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
      }
    };
    load();
  }, [slug, navigate]);

  const handleSave = async (member: Member) => {
    setSavingId(member.id);
    await supabase
      .from("team_members")
      .update({
        name: nameInputs[member.id] || member.name,
        email: emailInputs[member.id] || null,
        ical_url: icalInputs[member.id] || null,
      })
      .eq("id", member.id);
    setMembers((prev) =>
      prev.map((m) =>
        m.id === member.id
          ? { ...m, name: nameInputs[member.id] || m.name, email: emailInputs[member.id] || null, ical_url: icalInputs[member.id] || null }
          : m,
      ),
    );
    setSavingId(null);
  };

  const handleToggle = async (memberId: string, current: boolean) => {
    await supabase
      .from("team_members")
      .update({ is_active: !current })
      .eq("id", memberId);
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, is_active: !current } : m)),
    );
  };

  const handleDelete = async (memberId: string) => {
    if (!confirm("Remove this member?")) return;
    await supabase.from("team_members").delete().eq("id", memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const handleAddMember = async () => {
    if (!newName.trim() || !teamId) return;
    setAddingMember(true);
    const colorIndex = members.length % 4;
    const { data } = await supabase
      .from("team_members")
      .insert({ team_id: teamId, name: newName.trim(), color_index: colorIndex })
      .select()
      .single();
    if (data) {
      setMembers((prev) => [...prev, data]);
      setIcalInputs((prev) => ({ ...prev, [data.id]: "" }));
      setNameInputs((prev) => ({ ...prev, [data.id]: data.name }));
      setEmailInputs((prev) => ({ ...prev, [data.id]: "" }));
      setNewName("");
    }
    setAddingMember(false);
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
              <div className="flex gap-2">
                <Input
                  value={icalInputs[member.id] ?? ""}
                  onChange={(e) =>
                    setIcalInputs((prev) => ({ ...prev, [member.id]: e.target.value }))
                  }
                  placeholder="iCal URL (Google/Outlook calendar URL)"
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
