import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft } from "lucide-react";

type Step = 1 | 2;

const generateSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const CreateTeam = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [teamName, setTeamName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState("");
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Step 2
  const [memberCount, setMemberCount] = useState(2);
  const [memberNames, setMemberNames] = useState<string[]>(["", ""]);
  const [memberEmails, setMemberEmails] = useState<string[]>(["", ""]);
  const [memberIcalUrls, setMemberIcalUrls] = useState<string[]>(["", ""]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleNameChange = (value: string) => {
    setTeamName(value);
    setSlug(generateSlug(value));
    setSlugError("");
  };

  const handleSlugChange = (value: string) => {
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    setSlugError("");
  };

  const handleMemberCountChange = (count: number) => {
    const n = Math.max(1, Math.min(20, count));
    setMemberCount(n);
    const resize = (arr: string[]) => {
      const next = [...arr];
      while (next.length < n) next.push("");
      return next.slice(0, n);
    };
    setMemberNames(resize);
    setMemberEmails(resize);
    setMemberIcalUrls(resize);
    
  };

  const handleMemberFieldChange = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
  ) => {
    setter((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleStep1Next = async () => {
    if (!teamName.trim() || !slug.trim()) return;
    setCheckingSlug(true);
    const { data } = await supabase.from("teams").select("id").eq("slug", slug).maybeSingle();
    setCheckingSlug(false);
    if (data) {
      setSlugError("This slug is already taken. Please choose another.");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    const filledMembers = memberNames
      .map((name, i) => ({
        name: name.trim(),
        email: memberEmails[i]?.trim() || "",
        ical_url: memberIcalUrls[i]?.trim() || "",
      }))
      .filter((m) => m.name);
    if (filledMembers.length === 0) return;

    setIsSubmitting(true);
    setSubmitError("");
    try {
      const session = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-team`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({ name: teamName.trim(), slug, members: filledMembers }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create team");
      navigate(`/admin/${slug}`);
    } catch (err: any) {
      console.error(err);
      setSubmitError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-6 pt-16">
      <div className="w-full max-w-lg space-y-8">
        {/* Step indicator */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className={step >= 1 ? "text-booking-hero font-semibold" : "text-muted-foreground"}>
              1. Team Name
            </span>
            <span className="text-muted-foreground">→</span>
            <span className={step >= 2 ? "text-booking-hero font-semibold" : "text-muted-foreground"}>
              2. Members
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create Your Team Page</h1>
          <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Team Name *</label>
              <Input
                value={teamName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. MBAA Executive Committee"
                onKeyDown={(e) => e.key === "Enter" && handleStep1Next()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">URL Slug *</label>
              <Input
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="your-team-slug"
                onKeyDown={(e) => e.key === "Enter" && handleStep1Next()}
              />
              {slug && (
                <p className="text-xs text-muted-foreground">
                  Booking page:{" "}
                  <span className="text-booking-hero font-mono">/book/{slug}</span>
                </p>
              )}
              {slugError && <p className="text-xs text-destructive">{slugError}</p>}
            </div>
            <Button
              variant="booking"
              size="lg"
              className="w-full"
              onClick={handleStep1Next}
              disabled={!teamName.trim() || !slug.trim() || checkingSlug}
            >
              {checkingSlug ? "Checking..." : "Continue"}
            </Button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-6">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Number of Team Members</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={memberCount}
                onChange={(e) => handleMemberCountChange(parseInt(e.target.value) || 1)}
                className="w-28"
              />
            </div>
            <div className="space-y-6">
              {memberNames.map((name, i) => (
                <div key={i} className="space-y-3 p-4 rounded-lg border border-border">
                  <p className="text-sm font-semibold text-foreground">Member {i + 1}</p>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Name *</label>
                    <Input
                      value={name}
                      onChange={(e) => handleMemberFieldChange(setMemberNames, i, e.target.value)}
                      placeholder={`Team member ${i + 1}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Email</label>
                    <Input
                      type="email"
                      value={memberEmails[i] || ""}
                      onChange={(e) => handleMemberFieldChange(setMemberEmails, i, e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">iCal URL</label>
                    <Input
                      value={memberIcalUrls[i] || ""}
                      onChange={(e) => handleMemberFieldChange(setMemberIcalUrls, i, e.target.value)}
                      placeholder="https://calendar.google.com/calendar/ical/..."
                    />
                  </div>
                </div>
              ))}
            </div>
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            <Button
              variant="booking"
              size="lg"
              className="w-full"
              onClick={handleSubmit}
              disabled={isSubmitting || memberNames.every((n) => !n.trim())}
            >
              {isSubmitting ? "Creating..." : "Create Team Page"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateTeam;
