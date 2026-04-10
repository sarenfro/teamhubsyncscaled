import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import TeamMemberSelect, { type TeamMember } from "@/components/booking/TeamMemberSelect";
import DateTimePicker from "@/components/booking/DateTimePicker";
import BookingForm from "@/components/booking/BookingForm";
import BookingConfirmation from "@/components/booking/BookingConfirmation";

type Step = "select-member" | "select-datetime" | "enter-details" | "confirmed";

const Embed = () => {
  const [step, setStep] = useState<Step>("select-member");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookerName, setBookerName] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase.from("team_members").select("*").eq("is_active", true).order("color_index");
      if (data) {
        setMembers(
          data.map((m) => ({
            id: m.id,
            name: m.name,
            role: m.role ?? "",
            calendarType: m.calendar_type as "google" | "outlook",
            colorIndex: m.color_index,
          })),
        );
      }
    };
    fetchMembers();
  }, []);

  const handleMemberToggle = (member: TeamMember) => {
    setSelectedMembers((prev) =>
      prev.some((m) => m.id === member.id) ? prev.filter((m) => m.id !== member.id) : [...prev, member],
    );
  };

  const handleSelectAll = () => {
    setSelectedMembers(members);
    setStep("select-datetime");
  };

  const handleConfirmSelection = () => {
    setStep("select-datetime");
  };

  const handleDateTimeSelect = (date: Date, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setStep("enter-details");
  };

  const handleFormSubmit = async (data: { name: string; email: string; notes: string }) => {
    setIsSubmitting(true);
    setBookerName(data.name);
    setBookerEmail(data.email);

    try {
      await supabase.functions.invoke("create-booking", {
        body: {
          team_member_ids: selectedMembers.map((m) => m.id),
          booker_name: data.name,
          booker_email: data.email,
          notes: data.notes,
          meeting_date: selectedDate!.toISOString().split("T")[0],
          meeting_time: selectedTime!,
          duration_minutes: 30,
        },
      });

      setStep("confirmed");
    } catch (err) {
      console.error("Booking failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep("select-member");
    setSelectedMembers([]);
    setSelectedDate(null);
    setSelectedTime(null);
    setBookerName("");
    setBookerEmail("");
  };

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="mx-auto max-w-4xl">
        {step === "select-member" && (
          <TeamMemberSelect
            members={members}
            selectedIds={selectedMembers.map((m) => m.id)}
            onToggle={handleMemberToggle}
            onSelectAll={handleSelectAll}
            onConfirm={handleConfirmSelection}
          />
        )}

        {step === "select-datetime" && selectedMembers.length > 0 && (
          <DateTimePicker
            members={selectedMembers}
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
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
};

export default Embed;
