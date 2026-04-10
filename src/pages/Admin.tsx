import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Copy, Check, Users, Calendar } from "lucide-react";

interface Member {
  id: string;
  name: string;
  email: string | null;
  ical_url: string | null;
  is_active: boolean;
  color_index: number;
}

const avatarColors = [
  "bg-booking-avatar-1",
  "bg-booking-avatar-2",
  "bg-booking-avatar-3",
  "bg-booking-avatar-4",
];

const Admin = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [icalInputs, setIcalInputs] = useState<Record<string, string>>({});
  const [savingIcal, setSavingIcal] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

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
        .select("id, name")
        .eq("slug", slug!)
        .maybeSingle();
      if (!team) return;
      setTeamName(team.name);

      const { data: mData } = await supabase
        .from("team_members")
        .select("id, name, email, ical_url, is_active, color_index")
        .eq("team_id", team.id)
        .order("created_at");
      if (mData) {
        setMembers(mData);
        const inputs: Record<string, string> = {};
        mData.forEach((m) => { inputs[m.id] = m.ical_url ?? ""; });
        setIcalInputs(inputs);
      }
    };
    load();
  }, [slug, navigate]);

  const bookingUrl = `${window.location.origin}/book/${slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveIcal = async (memberId: string) => {
    setSavingIcal((prev) => ({ ...prev, [memberId]: true }));
    await supabase
      .from("team_members")
      .update({ ical_url: icalInputs[memberId] || null })
      .eq("id", memberId);
    setSavingIcal((prev) => ({ ...prev, [memberId]: false }));
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, ical_url: icalInputs[memberId] || null } : m,
      ),
    );
  };

  const handleToggleActive = async (memberId: string, current: boolean) => {
    await supabase
      .from("team_members")
      .update({ is_active: !current })
      .eq("id", memberId);
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, is_active: !current } : m)),
    );
  };

  const handleLogout = () => {
    localStorage.removeItem(`team_auth_${slug}`);
    navigate(`/login/${slug}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{teamName}</h1>
            <p className="text-sm text-muted-foreground">Admin Dashboard</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log Out
          </Button>
        </div>

        {/* Booking link */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Your Booking Page</h2>
          <div className="flex items-center gap-2">
            <Input value={bookingUrl} readOnly className="font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={handleCopy} title="Copy link">
              {copied ? (
                <Check className="h-4 w-4 text-booking-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <Button asChild variant="booking-outline" size="sm">
            <a href={bookingUrl} target="_blank" rel="noreferrer">
              Open Booking Page
            </a>
          </Button>
        </div>

        {/* Team members */}
        <div className="rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Team Members
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/${slug}/members`}>Manage Members</Link>
            </Button>
          </div>

          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-4 rounded-lg border border-border"
              >
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-primary-foreground ${avatarColors[member.color_index % avatarColors.length]}`}
                >
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground">{member.name}</span>
                    <Switch
                      checked={member.is_active}
                      onCheckedChange={() => handleToggleActive(member.id, member.is_active)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {member.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={icalInputs[member.id] ?? ""}
                      onChange={(e) =>
                        setIcalInputs((prev) => ({ ...prev, [member.id]: e.target.value }))
                      }
                      placeholder="Paste iCal URL here..."
                      className="text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSaveIcal(member.id)}
                      disabled={savingIcal[member.id]}
                    >
                      {savingIcal[member.id] ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bookings */}
        <div className="rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Upcoming Bookings
            </h2>
            <Button asChild variant="booking" size="sm">
              <Link to={`/admin/${slug}/bookings`}>View All Bookings</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            View and manage all scheduled meetings for your team.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Admin;
