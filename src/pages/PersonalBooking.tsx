import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, User as UserIcon, ChevronLeft } from "lucide-react";

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
}

const LOCATION_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  phone: "Phone Call",
  in_person: "In Person",
  custom: "Web Conference",
};

const PersonalBooking = () => {
  const { userSlug, eventSlug } = useParams<{ userSlug: string; eventSlug?: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
        .select("id, title, slug, description, duration_minutes, color, location_type")
        .eq("owner_user_id", profileData.user_id)
        .eq("is_active", true)
        .order("duration_minutes");

      if (types) setEventTypes(types);
      setLoading(false);
    };
    load();
  }, [userSlug]);

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

  // If an event slug is selected, redirect to the full booking flow
  if (eventSlug) {
    const selectedEvent = eventTypes.find((et) => et.slug === eventSlug);
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

    // TODO: Full booking calendar will go here in Phase 2
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(`/u/${userSlug}`)}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <div className="rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedEvent.color }} />
              <h2 className="text-xl font-bold text-foreground">{selectedEvent.title}</h2>
            </div>
            {selectedEvent.description && (
              <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {selectedEvent.duration_minutes} min</span>
              {selectedEvent.location_type && (
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {LOCATION_LABELS[selectedEvent.location_type] || selectedEvent.location_type}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground italic">
              Calendar booking will be available after availability settings are configured (Phase 2).
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Event type selection page (like Calendly's landing)
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
};

export default PersonalBooking;
