import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";

const TIMEZONES = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Anchorage", "Pacific/Honolulu", "Europe/London", "Europe/Paris",
  "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata",
  "Australia/Sydney", "Pacific/Auckland",
];

const generateSlug = (email: string) => {
  const name = email.split("@")[0].replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return name;
};

const Onboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [personalSlug, setPersonalSlug] = useState(() => user?.email ? generateSlug(user.email) : "");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles");
  const [slugError, setSlugError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!personalSlug.trim()) return;
    setSaving(true);
    setSlugError("");

    // Check if slug is taken
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("slug", personalSlug.trim())
      .neq("user_id", user!.id)
      .maybeSingle();

    if (existing) {
      setSlugError("This URL is already taken. Try another.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ slug: personalSlug.trim(), timezone })
      .eq("user_id", user!.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Create a default 30-minute event type
    await supabase.from("event_types").insert({
      title: "30 Minute Meeting",
      slug: "30-minute-meeting",
      duration_minutes: 30,
      color: "#3b82f6",
      owner_user_id: user!.id,
    });

    navigate("/dashboard");
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Set Up Your Profile</h1>
          <p className="text-sm text-muted-foreground">
            Choose your personal booking URL and timezone
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Your Booking URL *</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground whitespace-nowrap">{window.location.origin}/book/</span>
              <Input
                value={personalSlug}
                onChange={(e) => { setPersonalSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugError(""); }}
                placeholder="your-name"
                className="flex-1"
              />
            </div>
            {slugError && <p className="text-xs text-destructive">{slugError}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Timezone</label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="booking"
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={saving || !personalSlug.trim()}
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
