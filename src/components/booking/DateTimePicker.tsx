import { useState, useMemo, useEffect } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
  getDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { TeamMember } from "./TeamMemberSelect";

interface DateTimePickerProps {
  members: TeamMember[];
  onSelect: (date: Date, time: string) => void;
  onBack: () => void;
}

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const avatarColors = ["bg-booking-avatar-1", "bg-booking-avatar-2", "bg-booking-avatar-3", "bg-booking-avatar-4"];

function formatMemberNames(members: TeamMember[]): string {
  if (members.length === 0) return "";
  if (members.length === 1) return members[0].name;
  const firsts = members.map((m) => m.name.split(" ")[0]);
  return firsts.slice(0, -1).join(", ") + " & " + firsts[firsts.length - 1];
}

const DateTimePicker = ({ members, onSelect, onBack }: DateTimePickerProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    const paddingDays: (Date | null)[] = Array.from({ length: startDay }, () => null);
    return [...paddingDays, ...days];
  }, [currentMonth]);

  const isDateAvailable = (date: Date) => {
    const day = getDay(date);
    return day !== 0 && day !== 6 && !isBefore(date, startOfDay(new Date()));
  };

  useEffect(() => {
    if (!selectedDate) return;

    const fetchAvailability = async () => {
      setLoadingTimes(true);
      setAvailableTimes([]);

      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const memberIds = members.map((m) => m.id).join(",");

      try {
        const params = new URLSearchParams({ date: dateStr, member_ids: memberIds });

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-availability?${params.toString()}`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          },
        );

        if (res.ok) {
          const json = await res.json();
          setAvailableTimes(json.available_times ?? []);
        } else {
          console.error("Failed to fetch availability:", await res.text());
          setAvailableTimes([]);
        }
      } catch (err) {
        console.error("Availability fetch error:", err);
        setAvailableTimes([]);
      } finally {
        setLoadingTimes(false);
      }
    };

    fetchAvailability();
  }, [selectedDate, members]);

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    if (selectedDate) {
      onSelect(selectedDate, time);
    }
  };

  const timezone = "America/Los_Angeles";
  const memberLabel = formatMemberNames(members);

  return (
    <div className="flex flex-col lg:flex-row gap-0 rounded-xl border border-border bg-card overflow-hidden">
      {/* Left panel - Member info */}
      <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-border p-6 space-y-4">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {members.length > 1 ? (
          <div className="space-y-2">
            <div className="flex -space-x-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold 
  text-primary-foreground ring-2 ring-background ${avatarColors[m.colorIndex % avatarColors.length]}`}
                >
                  {m.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{memberLabel}</p>
            <h2 className="text-xl font-bold text-foreground">30 Minute Meeting</h2>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{memberLabel}</p>
            <h2 className="text-xl font-bold text-foreground">30 Minute Meeting</h2>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-muted">🕐</span>
          30 min
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-muted">📹</span>
          Web conferencing details provided upon confirmation.
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{timezone}</span>
        </div>
      </div>

      {/* Center panel - Calendar */}
      <div className="flex-1 p-6 border-b lg:border-b-0">
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Select a Date & Time</h3>

          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground">{format(currentMonth, "MMMM yyyy")}</h4>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} />;

              const available = isDateAvailable(day);
              const selected = selectedDate && isSameDay(day, selectedDate);
              const today = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    if (available) {
                      setSelectedDate(day);
                      setSelectedTime(null);
                    }
                  }}
                  disabled={!available}
                  className={`
                      relative h-10 w-full rounded-full text-sm font-medium transition-all
                      ${
                        selected
                          ? "bg-booking-selected text-booking-selected-foreground"
                          : available
                            ? "text-foreground hover:bg-booking-hover"
                            : "text-muted-foreground/40 cursor-not-allowed"
                      }
                      ${today && !selected ? "font-bold" : ""}
                    `}
                >
                  {format(day, "d")}
                  {today && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-booking-hero" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right panel - Time slots */}
      {selectedDate && (
        <div className="w-full lg:w-48 p-6 space-y-3 max-h-[400px] overflow-y-auto">
          <h4 className="text-sm font-semibold text-foreground">{format(selectedDate, "EEE, MMM d")}</h4>
          {loadingTimes ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : availableTimes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No available times.</p>
          ) : (
            <div className="space-y-2">
              {availableTimes.map((time) => (
                <Button
                  key={time}
                  variant={selectedTime === time ? "booking-time-selected" : "booking-time"}
                  size="sm"
                  onClick={() => handleTimeSelect(time)}
                  className="text-sm"
                >
                  {time}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DateTimePicker;
