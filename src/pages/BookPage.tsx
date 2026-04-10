import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import TeamMemberSelect, { type TeamMember } from "@/components/booking/TeamMemberSelect";
import DateTimePicker from "@/components/booking/DateTimePicker";
import BookingForm from "@/components/booking/BookingForm";
import BookingConfirmation from "@/components/booking/BookingConfirmation";

type Step = "select-member" | "select-datetime" | "enter-details" | "confirmed";

const BookPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [step, setStep] = useState<Step>("select-member");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookerName, setBookerName] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellationToken, setCancellationToken] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: team } = await supabase
        .from("teams")
        .select("id, name")
        .eq("slug", slug!)
        .maybeSingle();

      if (!team) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setTeamId(team.id);
      setTeamName(team.name);

      const { data: mData } = await supabase
        .from("team_members")
        .select("id, name, color_index")
        .eq("team_id", team.id)
        .eq("is_active", true)
        .order("created_at");

      if (mData) {
        setMembers(
          mData.map((m) => ({
            id: m.id,
            name: m.name,
            colorIndex: m.color_index ?? 0,
          })),
        );
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  if (notFound) return <Navigate to="/" replace />;

  const handleMemberToggle = (member: TeamMember) => {
    setSelectedMembers((prev) =>
      prev.some((m) => m.id === member.id)
        ? prev.filter((m) => m.id !== member.id)
        : [...prev, member],
    );
  };

  const handleSelectAll = () => {
    setSelectedMembers(members);
    setStep("select-datetime");
  };

  const handleConfirmSelection = () => setStep("select-datetime");

  const handleDateTimeSelect = (date: Date, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setStep("enter-details");
  };

  const handleFormSubmit = async (data2: { name: string; email: string; notes: string }) => {
    setIsSubmitting(true);
    setBookerName(data2.name);
    setBookerEmail(data2.email);
    try {
      const { data } = await supabase.functions.invoke("create-booking", {
        body: {
          team_id: teamId,
          team_member_ids: selectedMembers.map((m) => m.id),
          booker_name: data2.name,
          booker_email: data2.email,
          notes: data2.notes,
          meeting_date: selectedDate!.toISOString().split("T")[0],
          meeting_time: selectedTime!,
          duration_minutes: 30,
          app_url: window.location.origin,
        },
      });
      setCancellationToken(data?.cancellationToken ?? null);
      setStep("confirmed");
    } catch (err) {
      console.error("Booking failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setCancellationToken(null);
    setStep("select-member");
    setSelectedMembers([]);
    setSelectedDate(null);
    setSelectedTime(null);
    setBookerName("");
    setBookerEmail("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">{teamName}</h1>
          <p className="text-sm text-muted-foreground">Schedule a meeting with the team</p>
        </div>

        {step === "select-member" && (
          <TeamMemberSelect
            members={members}
            selectedIds={selectedMembers.map((m) => m.id)}
            onToggle={handleMemberToggle}
            onSelectAll={handleSelectAll}
            onConfirm={handleConfirmSelection}
          />
        )}

        {step === "select-datetime" && selectedMembers.length > 0 && teamId && (
          <DateTimePicker
            members={selectedMembers}
            teamId={teamId}
            onSelect={handleDateTimeSelect}
            onBack={() => setStep("select-member")}
          />
        )}

        {step === "enter-details" && selectedMembers.length > 0 && selectedDate && selectedTime && (
          <BookingForm
            members={selectedMembers}
            date={selectedDate}
            time={selectedTime}
            onSubmit={handleFormSubmit}
            onBack={() => setStep("select-datetime")}
            isSubmitting={isSubmitting}
          />
        )}

        {step === "confirmed" && selectedMembers.length > 0 && selectedDate && selectedTime && (
          <BookingConfirmation
            members={selectedMembers}
            date={selectedDate}
            time={selectedTime}
            bookerName={bookerName}
            bookerEmail={bookerEmail}
            cancellationToken={cancellationToken}
            onReset={handleReset}
          />
        )}

        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground">Powered by Team Scheduler</p>
        </div>
      </div>
    </div>
  );
};

export default BookPage;
