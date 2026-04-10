import { useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, Calendar, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TeamMember } from "./TeamMemberSelect";

interface BookingFormProps {
  members: TeamMember[];
  date: Date;
  time: string;
  onSubmit: (data: { name: string; email: string; notes: string }) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

function formatMemberNames(members: TeamMember[]): string {
  if (members.length === 0) return "";
  if (members.length === 1) return members[0].name;
  const firsts = members.map((m) => m.name.split(" ")[0]);
  return firsts.slice(0, -1).join(", ") + " & " + firsts[firsts.length - 1];
}

const BookingForm = ({ members, date, time, onSubmit, onBack, isSubmitting }: BookingFormProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, email, notes });
  };

  const memberLabel = formatMemberNames(members);

  return (
    <div
      className="flex flex-col lg:flex-row gap-0 rounded-xl border border-border bg-card overflow-hidden max-w-3xl
  mx-auto"
    >
      {/* Left panel - Summary */}
      <div className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-border p-6 space-y-4">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{memberLabel}</p>
          <h2 className="text-xl font-bold text-foreground">30 Minute Meeting</h2>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 flex-shrink-0 text-booking-hero" />
            <span>{format(date, "EEEE, MMMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 flex-shrink-0 text-booking-hero" />
            <span>{time}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 flex-shrink-0 text-booking-hero" />
            <span>{memberLabel}</span>
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Enter Details</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Name *</label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email *</label>
            <Input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Additional Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Please share anything that will help prepare for our meeting."
              className="rounded-lg min-h-[100px]"
            />
          </div>

          <Button type="submit" variant="booking" size="lg" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Scheduling..." : "Schedule Event"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default BookingForm;
