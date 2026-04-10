import { Check, Clock, Video, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  calendarType: "google" | "outlook";
  colorIndex: number;
}

interface TeamMemberSelectProps {
  members: TeamMember[];
  selectedIds: string[];
  onToggle: (member: TeamMember) => void;
  onSelectAll: () => void;
  onConfirm: () => void;
}

const avatarColors = ["bg-booking-avatar-1", "bg-booking-avatar-2", "bg-booking-avatar-3", "bg-booking-avatar-4"];

const TeamMemberSelect = ({ members, selectedIds, onToggle, onSelectAll, onConfirm }: TeamMemberSelectProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Meet your MBAA EC</h2>
        <p className="text-muted-foreground">Select one or more members to schedule a meeting with</p>
      </div>

      {/* Book with entire team button */}
      <button
        onClick={onSelectAll}
        className="group relative flex w-full items-center gap-4 rounded-xl border-2 border-booking-hero
  bg-booking-hero-light p-5 transition-all hover:shadow-lg hover:shadow-booking-hero/10"
      >
        <div className="flex -space-x-3">
          {members.map((member) => (
            <div
              key={member.id}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-primary-foreground
   ring-2 ring-background ${avatarColors[member.colorIndex % avatarColors.length]}`}
            >
              {member.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
          ))}
        </div>
        <div className="text-left flex-1">
          <h3 className="font-semibold text-foreground group-hover:text-booking-hero transition-colors">
            Meet with Any Team Member
          </h3>
          <p className="text-sm text-muted-foreground">
            Book the next available slot across all {members.length} members
          </p>
        </div>
        <Users className="h-5 w-5 text-booking-hero" />
      </button>

      <div className="grid gap-4 sm:grid-cols-2">
        {members.map((member) => {
          const isSelected = selectedIds.includes(member.id);
          return (
            <button
              key={member.id}
              onClick={() => onToggle(member)}
              className={`group relative flex flex-col items-center gap-4 rounded-xl border p-6 text-left transition-all
  hover:shadow-lg hover:shadow-booking-hero/5 ${
    isSelected
      ? "border-2 border-booking-hero bg-booking-hero-light"
      : "border-border bg-card hover:border-booking-hero"
  }`}
            >
              {isSelected && (
                <div
                  className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full
  bg-booking-hero"
                >
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}

              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold 
  text-primary-foreground ${avatarColors[member.colorIndex % avatarColors.length]}`}
              >
                {member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>

              <div className="text-center space-y-1">
                <h3
                  className={`font-semibold transition-colors ${
                    isSelected ? "text-booking-hero" : "text-foreground group-hover:text-booking-hero"
                  }`}
                >
                  {member.name}
                </h3>
                <p className="text-sm text-muted-foreground">{member.role}</p>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> 30 min
                </span>
                <span className="flex items-center gap-1">
                  <Video className="h-3 w-3" /> Video call
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button variant="booking" size="lg" onClick={onConfirm}>
            Find Available Times
            {selectedIds.length > 1 ? ` for ${selectedIds.length} people` : ""}
          </Button>
        </div>
      )}
    </div>
  );
};

export default TeamMemberSelect;
