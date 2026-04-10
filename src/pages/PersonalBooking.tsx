import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Clock, MapPin, User as UserIcon, ChevronLeft, Globe } from "lucide-react";
import { format, addDays, isBefore, startOfDay, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  display_name: string | null;
  slug: string;
  timezone: string;
  user_id: string;
}

interface EventType {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  color: string;
  location_type: string | null;
  location_value: string | null;
  buffer_minutes: number;
  min_notice_minutes: number;
  max_days_advance: number;
  owner_user_id: string | null;
}

interface DaySchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface Booking {
  meeting_date: string;
  meeting_time: string;
  duration_minutes: number | null;
}

interface BusyPeriod {
  start: string; // HH:MM
  end: string;   // HH:MM
}

const LOCATION_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  phone: "Phone Call",
  in_person: "In Person",
  custom: "Web Conference",
};

const generateTimeSlots = (
  startTime: string,
  endTime: string,
  durationMinutes: number,
  bufferMinutes: number,
): string[] => {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  let current = startTotal;
  while (current + durationMinutes <= endTotal) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    current += durationMinutes + bufferMinutes;
  }
  return slots;
};

const formatTimeDisplay = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
};

const PersonalBooking = () => {
  const { userSlug, eventSlug } = useParams<{ userSlug: string; eventSlug?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Booking state
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Form state
  const [bookerName, setBookerName] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Timezone
  const [inviteeTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  useEffect(() => {
    const load = async () => {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, slug, timezone, user_id")
        .eq("slug", userSlug!)
        .maybeSingle();

      if (!profileData) { setNotFound(true); setLoading(false); return; }
      setProfile(profileData);

      const { data: types } = await supabase
        .from("event_types")
        .select("id, title, slug, description, duration_minutes, color, location_type, location_value, buffer_minutes, min_notice_minutes, max_days_advance, owner_user_id")
        .eq("owner_user_id", profileData.user_id)
        .eq("is_active", true)
        .order("duration_minutes");

      if (types) setEventTypes(types as EventType[]);

      // Load availability schedule
      const { data: sched } = await supabase
        .from("availability_schedules")
        .select("day_of_week, start_time, end_time, is_available")
        .eq("user_id", profileData.user_id);

      if (sched) {
        setSchedule(sched.map(s => ({
          ...s,
          start_time: s.start_time.slice(0, 5),
          end_time: s.end_time.slice(0, 5),
        })));
      }

      // Load existing bookings
      const { data: bookings } = await supabase
        .from("bookings")
        .select("meeting_date, meeting_time, duration_minutes")
        .eq("status", "confirmed");

      if (bookings) setExistingBookings(bookings);

      setLoading(false);
    };
    load();
  }, [userSlug]);

  const selectedEvent = eventSlug ? eventTypes.find((et) => et.slug === eventSlug) : null;

  // Generate slots when date is selected
  useEffect(() => {
    if (!selectedDate || !selectedEvent || schedule.length === 0) {
      setAvailableSlots([]);
      return;
    }

    const dayOfWeek = selectedDate.getDay();
    const daySchedule = schedule.find((s) => s.day_of_week === dayOfWeek);

    if (!daySchedule || !daySchedule.is_available) {
      setAvailableSlots([]);
      return;
    }

    const allSlots = generateTimeSlots(
      daySchedule.start_time,
      daySchedule.end_time,
      selectedEvent.duration_minutes,
      selectedEvent.buffer_minutes,
    );

    // Filter out booked slots
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const bookedTimes = existingBookings
      .filter((b) => b.meeting_date === dateStr)
      .map((b) => b.meeting_time);

    // Filter out past times for today
    const now = new Date();
    const minNoticeTime = new Date(now.getTime() + selectedEvent.min_notice_minutes * 60 * 1000);

    // Fetch Google Calendar busy times
    const fetchAndFilter = async () => {
      let gcalBusy: BusyPeriod[] = [];
      if (profile?.user_id) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-busy?user_id=${profile.user_id}&date=${dateStr}`,
            {
              headers: {
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
            },
          );
          if (res.ok) {
            const data = await res.json();
            gcalBusy = data.busy_times || [];
          }
        } catch {
          // Ignore — proceed without Google Calendar data
        }
      }

      const filtered = allSlots.filter((slot) => {
        if (bookedTimes.includes(slot)) return false;

        const [slotH, slotM] = slot.split(":").map(Number);
        const slotStartMin = slotH * 60 + slotM;
        const slotEndMin = slotStartMin + selectedEvent.duration_minutes;

        // Check Google Calendar conflicts
        for (const busy of gcalBusy) {
          const [bsH, bsM] = busy.start.split(":").map(Number);
          const [beH, beM] = busy.end.split(":").map(Number);
          const busyStart = bsH * 60 + bsM;
          const busyEnd = beH * 60 + beM;
          if (slotStartMin < busyEnd && slotEndMin > busyStart) return false;
        }

        if (dateStr === format(now, "yyyy-MM-dd")) {
          const slotDate = new Date(selectedDate);
          slotDate.setHours(slotH, slotM, 0, 0);
          if (isBefore(slotDate, minNoticeTime)) return false;
        }

        return true;
      });

      setAvailableSlots(filtered);
      setSelectedTime(null);
    };

    fetchAndFilter();
  }, [selectedDate, selectedEvent, schedule, existingBookings]);

  const isDateDisabled = (date: Date) => {
    if (!selectedEvent) return true;
    const today = startOfDay(new Date());
    if (isBefore(date, today)) return true;
    const maxDate = addDays(today, selectedEvent.max_days_advance);
    if (date > maxDate) return true;
    const dayOfWeek = date.getDay();
    const daySchedule = schedule.find((s) => s.day_of_week === dayOfWeek);
    return !daySchedule || !daySchedule.is_available;
  };

  const handleBook = async () => {
    if (!selectedDate || !selectedTime || !bookerName.trim() || !bookerEmail.trim() || !selectedEvent) return;
    setSubmitting(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-booking`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            team_member_id: null,
            team_id: null,
            event_type_id: selectedEvent.id,
            owner_user_id: selectedEvent.owner_user_id,
            booker_name: bookerName.trim(),
            booker_email: bookerEmail.trim(),
            notes: notes.trim() || null,
            meeting_date: format(selectedDate, "yyyy-MM-dd"),
            meeting_time: selectedTime,
            duration_minutes: selectedEvent.duration_minutes,
          }),
        }
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Booking failed");
      }

      setConfirmed(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-foreground">Page Not Found</h1>
          <p className="text-muted-foreground">This booking page doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Booking confirmation
  if (confirmed && selectedEvent && selectedDate && selectedTime) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-booking-hero-light">
            <Clock className="h-8 w-8 text-booking-hero" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">You're Booked!</h1>
          <div className="rounded-xl border border-border p-6 text-left space-y-3">
            <p className="font-semibold text-foreground">{selectedEvent.title}</p>
            <p className="text-sm text-muted-foreground">
              {format(selectedDate, "EEEE, MMMM d, yyyy")} at {formatTimeDisplay(selectedTime)}
            </p>
            <p className="text-sm text-muted-foreground">{selectedEvent.duration_minutes} minutes</p>
            {selectedEvent.location_type && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {LOCATION_LABELS[selectedEvent.location_type] || selectedEvent.location_type}
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">A confirmation email has been sent to {bookerEmail}.</p>
        </div>
      </div>
    );
  }

  // Event type selection (no eventSlug)
  if (!eventSlug) {
    return (
      <div className="min-h-screen bg-background flex items-start justify-center p-6 pt-16">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-booking-hero-light">
              <UserIcon className="h-7 w-7 text-booking-hero" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{profile?.display_name || userSlug}</h1>
            <p className="text-sm text-muted-foreground">Select an event type to schedule a meeting</p>
          </div>

          {eventTypes.length === 0 ? (
            <div className="rounded-xl border border-border p-8 text-center">
              <p className="text-muted-foreground">No event types available right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {eventTypes.map((et) => (
                <button
                  key={et.id}
                  onClick={() => navigate(`/u/${userSlug}/${et.slug}`)}
                  className="w-full rounded-xl border border-border p-5 text-left hover:bg-accent/50 transition-colors flex items-center gap-4"
                >
                  <div className="h-full w-1.5 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: et.color }} />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-semibold text-foreground">{et.title}</p>
                    {et.description && <p className="text-sm text-muted-foreground truncate">{et.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {et.duration_minutes} min</span>
                      {et.location_type && (
                        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {LOCATION_LABELS[et.location_type] || et.location_type}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Event not found
  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-foreground">Event Not Found</h1>
          <p className="text-muted-foreground">This event type doesn't exist or is no longer active.</p>
          <Button variant="booking" onClick={() => navigate(`/u/${userSlug}`)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Events
          </Button>
        </div>
      </div>
    );
  }

  // No availability set
  if (schedule.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">{selectedEvent.title}</h1>
          <p className="text-muted-foreground">This person hasn't set up their availability yet.</p>
          <Button variant="outline" onClick={() => navigate(`/u/${userSlug}`)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </div>
      </div>
    );
  }

  // Main booking view: calendar + time slots + form
  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-4xl">
        <Button variant="ghost" size="sm" className="-ml-2 mb-4" onClick={() => navigate(`/u/${userSlug}`)}>
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_1fr]">
            {/* Left: Event info */}
            <div className="border-b md:border-b-0 md:border-r border-border p-6 space-y-4">
              <p className="text-sm text-muted-foreground">{profile?.display_name || userSlug}</p>
              <h2 className="text-xl font-bold text-foreground">{selectedEvent.title}</h2>
              {selectedEvent.description && (
                <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
              )}
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><Clock className="h-4 w-4" /> {selectedEvent.duration_minutes} min</p>
                {selectedEvent.location_type && (
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {LOCATION_LABELS[selectedEvent.location_type] || selectedEvent.location_type}</p>
                )}
                <p className="flex items-center gap-2"><Globe className="h-4 w-4" /> {inviteeTimezone.replace(/_/g, " ")}</p>
              </div>
            </div>

            {/* Middle: Calendar */}
            <div className="border-b md:border-b-0 md:border-r border-border p-4 flex items-start justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => setSelectedDate(d)}
                disabled={isDateDisabled}
                className="pointer-events-auto"
              />
            </div>

            {/* Right: Time slots or form */}
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {!selectedDate ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground text-center">Select a date to see available times</p>
                </div>
              ) : selectedTime === null ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground mb-3">
                    {format(selectedDate, "EEEE, MMMM d")}
                  </p>
                  {availableSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No available times on this date.</p>
                  ) : (
                    availableSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedTime(slot)}
                        className="w-full py-2.5 px-4 rounded-lg border border-booking-hero text-booking-hero text-sm font-medium hover:bg-booking-hero hover:text-primary-foreground transition-colors"
                      >
                        {formatTimeDisplay(slot)}
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      {format(selectedDate, "EEE, MMM d")} at {formatTimeDisplay(selectedTime)}
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedTime(null)}>
                      Change
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Name *</label>
                      <Input value={bookerName} onChange={(e) => setBookerName(e.target.value)} placeholder="Your name" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Email *</label>
                      <Input type="email" value={bookerEmail} onChange={(e) => setBookerEmail(e.target.value)} placeholder="you@example.com" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Notes</label>
                      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything you'd like to share" />
                    </div>
                    <Button
                      variant="booking"
                      className="w-full"
                      onClick={handleBook}
                      disabled={submitting || !bookerName.trim() || !bookerEmail.trim()}
                    >
                      {submitting ? "Booking..." : "Confirm Booking"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalBooking;
