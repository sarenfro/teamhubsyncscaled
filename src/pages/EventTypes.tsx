import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Clock, Link as LinkIcon, ToggleLeft, ToggleRight, ChevronLeft, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EventType {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  color: string;
  is_active: boolean;
  location_type: string | null;
  location_value: string | null;
  owner_user_id: string | null;
  owner_team_id: string | null;
}

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];
const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#22c55e", "#06b6d4", "#6366f1"];
const LOCATIONS = [
  { value: "google_meet", label: "Google Meet" },
  { value: "zoom", label: "Zoom" },
  { value: "phone", label: "Phone Call" },
  { value: "in_person", label: "In Person" },
  { value: "custom", label: "Custom" },
];

const generateSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const EventTypes = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [color, setColor] = useState(COLORS[0]);
  const [locationType, setLocationType] = useState("google_meet");
  const [locationValue, setLocationValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    const load = async () => {
      const [{ data: profile }, { data: types }] = await Promise.all([
        supabase.from("profiles").select("slug").eq("user_id", user.id).maybeSingle(),
        supabase.from("event_types").select("*").eq("owner_user_id", user.id).order("created_at"),
      ]);
      if (profile?.slug) setProfileSlug(profile.slug);
      if (types) setEventTypes(types as EventType[]);
      setLoading(false);
    };
    load();
  }, [user, authLoading]);

  const resetForm = () => {
    setTitle(""); setSlug(""); setDescription(""); setDuration(30);
    setColor(COLORS[0]); setLocationType("google_meet"); setLocationValue("");
    setEditingId(null); setShowForm(false);
  };

  const handleEdit = (et: EventType) => {
    setEditingId(et.id);
    setTitle(et.title);
    setSlug(et.slug);
    setDescription(et.description || "");
    setDuration(et.duration_minutes);
    setColor(et.color);
    setLocationType(et.location_type || "google_meet");
    setLocationValue(et.location_value || "");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !slug.trim()) return;
    setSaving(true);
    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      duration_minutes: duration,
      color,
      location_type: locationType,
      location_value: locationValue.trim() || null,
      owner_user_id: user!.id,
    };

    if (editingId) {
      const { error } = await supabase.from("event_types").update(payload).eq("id", editingId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
      setEventTypes((prev) => prev.map((et) => et.id === editingId ? { ...et, ...payload } : et));
    } else {
      const { data, error } = await supabase.from("event_types").insert(payload).select().single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
      setEventTypes((prev) => [...prev, data as EventType]);
    }
    resetForm();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event type?")) return;
    await supabase.from("event_types").delete().eq("id", id);
    setEventTypes((prev) => prev.filter((et) => et.id !== id));
  };

  const handleToggle = async (id: string, current: boolean) => {
    await supabase.from("event_types").update({ is_active: !current }).eq("id", id);
    setEventTypes((prev) => prev.map((et) => et.id === id ? { ...et, is_active: !current } : et));
  };

  const handleCopy = () => {
    if (profileSlug) {
      navigator.clipboard.writeText(`${window.location.origin}/book/${profileSlug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/dashboard")}>
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Event Types</h1>
            <p className="text-sm text-muted-foreground">Create and manage your meeting types</p>
          </div>
          <Button variant="booking" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Event Type
          </Button>
        </div>

        {profileSlug && (
          <div className="flex items-center gap-2 text-sm">
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Your booking link:</span>
            <code className="text-booking-hero font-mono">{window.location.origin}/book/{profileSlug}</code>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
              {copied ? <Check className="h-3 w-3 text-booking-success" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        )}

        {/* Event type form */}
        {showForm && (
          <div className="rounded-xl border border-border p-6 space-y-4">
            <h2 className="font-semibold text-foreground">{editingId ? "Edit Event Type" : "New Event Type"}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Title *</label>
                <Input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); if (!editingId) setSlug(generateSlug(e.target.value)); }}
                  placeholder="e.g. 30 Minute Meeting"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">URL Slug *</label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="30-minute-meeting" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description for invitees" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Duration</label>
                <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Location</label>
                <Select value={locationType} onValueChange={setLocationType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Color</label>
                <div className="flex gap-2 pt-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`h-7 w-7 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            {(locationType === "zoom" || locationType === "custom" || locationType === "phone") && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {locationType === "phone" ? "Phone Number" : locationType === "zoom" ? "Zoom Link" : "Meeting URL"}
                </label>
                <Input value={locationValue} onChange={(e) => setLocationValue(e.target.value)} placeholder={locationType === "phone" ? "+1 555 0100" : "https://..."} />
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="booking" onClick={handleSave} disabled={saving || !title.trim() || !slug.trim()}>
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Event types list */}
        {eventTypes.length === 0 && !showForm ? (
          <div className="rounded-xl border border-border p-10 text-center space-y-3">
            <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">No event types yet.</p>
            <p className="text-sm text-muted-foreground">Create your first event type to start accepting bookings.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {eventTypes.map((et) => (
              <div
                key={et.id}
                className={`rounded-xl border p-5 flex items-center gap-4 transition-opacity ${et.is_active ? "border-border" : "border-border opacity-60"}`}
              >
                <div className="h-10 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: et.color }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{et.title}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" /> {et.duration_minutes} min
                    {et.description && <span className="truncate">· {et.description}</span>}
                  </p>
                  {profileSlug && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">/book/{profileSlug}/{et.slug}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleToggle(et.id, et.is_active)} title={et.is_active ? "Deactivate" : "Activate"}>
                    {et.is_active ? <ToggleRight className="h-4 w-4 text-booking-success" /> : <ToggleLeft className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(et)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(et.id)} className="hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventTypes;
