import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Calendar, Clock, User } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Booking {
  id: string;
  booker_name: string;
  booker_email: string;
  notes: string | null;
  meeting_date: string;
  meeting_time: string;
  duration_minutes: number;
  status: string;
  team_member: { name: string } | null;
}

const AdminBookings = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    const load = async () => {
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .eq("slug", slug!)
        .maybeSingle();
      if (!team) { setLoading(false); return; }

      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("bookings")
        .select(
          "id, booker_name, booker_email, notes, meeting_date, meeting_time, duration_minutes, status, team_member:team_member_id(name)",
        )
        .eq("team_id", team.id)
        .gte("meeting_date", today)
        .order("meeting_date")
        .order("meeting_time");

      if (data) setBookings(data as unknown as Booking[]);
      setLoading(false);
    };
    load();
  }, [slug, user, authLoading]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/admin/${slug}`}>
            <ChevronLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>

        <h1 className="text-2xl font-bold text-foreground">Upcoming Bookings</h1>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : bookings.length === 0 ? (
          <div className="rounded-xl border border-border p-10 text-center space-y-3">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">No upcoming bookings yet.</p>
            <p className="text-sm text-muted-foreground">
              Share your booking page so people can schedule meetings.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <div key={booking.id} className="rounded-xl border border-border p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 text-booking-hero flex-shrink-0" />
                      <span>{format(parseISO(booking.meeting_date), "EEEE, MMMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 text-booking-hero flex-shrink-0" />
                      <span>
                        {booking.meeting_time} ({booking.duration_minutes} min)
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      booking.status === "confirmed"
                        ? "bg-booking-hero-light text-booking-hero"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-foreground">{booking.booker_name}</span>
                  <span className="text-muted-foreground">({booking.booker_email})</span>
                </div>

                {booking.team_member && (
                  <p className="text-xs text-muted-foreground">
                    With: {booking.team_member.name}
                  </p>
                )}

                {booking.notes && (
                  <p className="text-sm text-muted-foreground border-t border-border pt-2 italic">
                    "{booking.notes}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBookings;
