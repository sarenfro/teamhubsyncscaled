import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft } from "lucide-react";

type Step = 1 | 2 | 3;

const generateSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const CreateTeam = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [teamName, setTeamName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState("");
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Step 2
  const [memberCount, setMemberCount] = useState(2);
  const [memberNames, setMemberNames] = useState<string[]>(["", ""]);

  // Step 3
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setMemberNames((prev) => {
      const next = [...prev];
      while (next.length < n) next.push("");
      return next.slice(0, n);
    });
  };

  const handleMemberNameChange = (index: number, value: string) => {
    setMemberNames((prev) => {
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

  const handleStep3Submit = async () => {
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    const filledMembers = memberNames.map((n) => n.trim()).filter(Boolean);
    if (filledMembers.length === 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-team`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ name: teamName.trim(), slug, password, members: filledMembers }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create team");

      localStorage.setItem(
        `team_auth_${slug}`,
        JSON.stringify({ teamId: json.teamId, slug, authorized: true }),
      );
      navigate(`/admin/${slug}`);
    } catch (err) {
      console.error(err);
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <span className="text-muted-foreground">→</span>
            <span className={step >= 3 ? "text-booking-hero font-semibold" : "text-muted-foreground"}>
              3. Password
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create Your Team Page</h1>
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
            <div className="space-y-3">
              {memberNames.map((name, i) => (
                <div key={i} className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    {i === 0 ? "Your Name (Team Admin)" : `Member ${i + 1}`} *
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => handleMemberNameChange(i, e.target.value)}
                    placeholder={i === 0 ? "Your full name" : `Team member ${i + 1}`}
                  />
                </div>
              ))}
            </div>
            <Button
              variant="booking"
              size="lg"
              className="w-full"
              onClick={() => setStep(3)}
              disabled={memberNames.every((n) => !n.trim())}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-6">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Team Password *</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
                }}
                placeholder="Set a shared team password"
              />
              <p className="text-xs text-muted-foreground">
                Share this password with your teammates so they can access the admin dashboard.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Confirm Password *</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError("");
                }}
                placeholder="Confirm password"
                onKeyDown={(e) => e.key === "Enter" && handleStep3Submit()}
              />
              {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
            </div>
            <Button
              variant="booking"
              size="lg"
              className="w-full"
              onClick={handleStep3Submit}
              disabled={isSubmitting || !password || !confirmPassword}
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
