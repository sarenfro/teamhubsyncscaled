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
  teamId?: string;
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

interface MemberBusy {
  id: string;
  name: string;
  busy: { start: string; end: string }[];
}

const DateTimePicker = ({ members, teamId, onSelect, onBack }: DateTimePickerProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [memberBusy, setMemberBusy] = useState<MemberBusy[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "day">("list");

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
      setMemberBusy([]);

      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const memberIds = members.map((m) => m.id).join(",");

      try {
        const queryParams: Record<string, string> = { date: dateStr, member_ids: memberIds };
        if (teamId) queryParams.team_id = teamId;
        const params = new URLSearchParams(queryParams);

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
          setMemberBusy(json.member_busy ?? []);
        } else {
          console.error("Failed to fetch availability:", await res.text());
          setAvailableTimes([]);
          setMemberBusy([]);
        }
      } catch (err) {
        console.error("Availability fetch error:", err);
        setAvailableTimes([]);
        setMemberBusy([]);
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

      {/* Right panel - Time slots / Day view */}
      {selectedDate && (
        <div
          className={`w-full p-6 space-y-3 ${
            viewMode === "day" ? "lg:w-[420px]" : "lg:w-48"
          } max-h-[480px] overflow-y-auto`}
        >
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              {format(selectedDate, "EEE, MMM d")}
            </h4>
            <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
              <button
                onClick={() => setViewMode("list")}
                className={`px-2 py-1 transition-colors ${
                  viewMode === "list"
                    ? "bg-booking-selected text-booking-selected-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("day")}
                className={`px-2 py-1 transition-colors ${
                  viewMode === "day"
                    ? "bg-booking-selected text-booking-selected-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Day
              </button>
            </div>
          </div>

          {loadingTimes ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : viewMode === "list" ? (
            availableTimes.length === 0 ? (
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
            )
          ) : (
            <DayTimeline
              date={selectedDate}
              members={members}
              memberBusy={memberBusy}
              availableTimes={availableTimes}
              selectedTime={selectedTime}
              onSelectTime={handleTimeSelect}
            />
          )}
        </div>
      )}
    </div>
  );
};

// Daily timeline: 8am–6pm, one column per team member, busy blocks shaded.
// Clicking an empty 30-min slot books that time (when it's also in availableTimes).
interface DayTimelineProps {
  date: Date;
  members: TeamMember[];
  memberBusy: MemberBusy[];
  availableTimes: string[];
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
}

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 18; // exclusive
const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const PIXELS_PER_MINUTE = 1.2; // 720px total height
const TIMELINE_HEIGHT = TOTAL_MINUTES * PIXELS_PER_MINUTE;

function formatHourLabel(h: number): string {
  const period = h >= 12 ? "pm" : "am";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${period}`;
}

function timeLabelFromHourMinute(h: number, m: number): string {
  const period = h >= 12 ? "pm" : "am";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${m.toString().padStart(2, "0")} ${period}`;
}

const DayTimeline = ({
  date,
  members,
  memberBusy,
  availableTimes,
  selectedTime,
  onSelectTime,
}: DayTimelineProps) => {
  // Compute busy block positions for each member, in minutes-from-DAY_START in Seattle TZ
  const memberBusyById = new Map(memberBusy.map((mb) => [mb.id, mb.busy]));

  const dateStr = format(date, "yyyy-MM-dd");

  const minutesFromStartInSeattle = (iso: string): number => {
    const d = new Date(iso);
    // Get seattle hour/minute
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const p: Record<string, number> = {};
    parts.forEach(({ type, value }) => {
      if (type !== "literal") p[type] = parseInt(value);
    });
    const sameDay = `${p.year}-${p.month.toString().padStart(2, "0")}-${p.day
      .toString()
      .padStart(2, "0")}` === dateStr;
    const hour = p.hour % 24;
    const minute = p.minute;
    if (!sameDay) {
      // Block runs across midnight; clamp to day boundaries
      return d < new Date(`${dateStr}T00:00:00`) ? -Infinity : Infinity;
    }
    return (hour - DAY_START_HOUR) * 60 + minute;
  };

  // Build 30-min slot rows
  const slots: { hour: number; minute: number; label: string }[] = [];
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
    for (const m of [0, 30]) {
      slots.push({ hour: h, minute: m, label: timeLabelFromHourMinute(h, m) });
    }
  }

  const availableSet = new Set(availableTimes);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* Header */}
      <div
        className="grid border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground"
        style={{ gridTemplateColumns: `48px repeat(${members.length}, minmax(0,1fr))` }}
      >
        <div className="px-1 py-2"></div>
        {members.map((m) => (
          <div key={m.id} className="px-1 py-2 text-center truncate" title={m.name}>
            {m.name.split(" ")[0]}
          </div>
        ))}
      </div>

      {/* Timeline body */}
      <div
        className="relative grid"
        style={{
          gridTemplateColumns: `48px repeat(${members.length}, minmax(0,1fr))`,
          height: `${TIMELINE_HEIGHT}px`,
        }}
      >
        {/* Hour labels + grid lines */}
        <div className="relative border-r border-border">
          {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => {
            const h = DAY_START_HOUR + i;
            return (
              <div
                key={h}
                className="absolute left-0 right-0 text-[10px] text-muted-foreground px-1 -translate-y-1/2"
                style={{ top: `${i * 60 * PIXELS_PER_MINUTE}px` }}
              >
                {formatHourLabel(h)}
              </div>
            );
          })}
        </div>

        {/* Member columns */}
        {members.map((m) => {
          const busy = memberBusyById.get(m.id) ?? [];
          return (
            <div key={m.id} className="relative border-r border-border last:border-r-0">
              {/* Hour grid lines */}
              {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-border/50"
                  style={{ top: `${(i + 1) * 60 * PIXELS_PER_MINUTE}px` }}
                />
              ))}

              {/* Clickable 30-min slot rows */}
              {slots.map((slot) => {
                const top =
                  ((slot.hour - DAY_START_HOUR) * 60 + slot.minute) * PIXELS_PER_MINUTE;
                const isAvailable = availableSet.has(slot.label);
                const isSelected = selectedTime === slot.label;
                return (
                  <button
                    key={`${m.id}-${slot.hour}-${slot.minute}`}
                    onClick={() => isAvailable && onSelectTime(slot.label)}
                    disabled={!isAvailable}
                    className={`absolute left-0 right-0 z-0 transition-colors ${
                      isSelected
                        ? "bg-booking-selected/30"
                        : isAvailable
                          ? "hover:bg-booking-hover/60 cursor-pointer"
                          : "cursor-not-allowed"
                    }`}
                    style={{ top: `${top}px`, height: `${30 * PIXELS_PER_MINUTE}px` }}
                    title={isAvailable ? `Book ${slot.label}` : "Unavailable"}
                  />
                );
              })}

              {/* Busy blocks (rendered above slot buttons) */}
              {busy.map((b, idx) => {
                const startMin = minutesFromStartInSeattle(b.start);
                const endMin = minutesFromStartInSeattle(b.end);
                const clampedStart = Math.max(0, startMin);
                const clampedEnd = Math.min(TOTAL_MINUTES, endMin);
                if (clampedEnd <= 0 || clampedStart >= TOTAL_MINUTES) return null;
                const height = Math.max(4, (clampedEnd - clampedStart) * PIXELS_PER_MINUTE);
                return (
                  <div
                    key={idx}
                    className="absolute left-1 right-1 z-10 rounded-sm bg-destructive/70 border border-destructive pointer-events-none"
                    style={{
                      top: `${clampedStart * PIXELS_PER_MINUTE}px`,
                      height: `${height}px`,
                    }}
                    title="Busy"
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground p-2 border-t border-border bg-muted/30">
        Red blocks = busy. Click an empty slot to book.
      </p>
    </div>
  );
};

export default DateTimePicker;
