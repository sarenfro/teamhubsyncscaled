import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, Search, XCircle, CheckCircle, User } from "lucide-react";
import { format, parseISO } from "date-fns";

interface BookingResult {
  id: string;
  meeting_date: string;
  meeting_time: string;
  duration_minutes: number;
  status: string;
  team_member_name: string;
  cancellation_token: string | null;
}

const ManageBooking = () => {
  const [email, setEmail] = useState("");
  const [bookings, setBookings] = useState<BookingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke("lookup-bookings", {
        body: { email: email.trim() },
      });
      if (error) throw error;
      setBookings(data?.bookings ?? []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Manage Your Bookings</h1>
          <p className="text-sm text-muted-foreground">
            Enter the email address you used when booking to view and manage your appointments.
          </p>
        </div>

        <form onSubmit={handleLookup} className="flex gap-2">
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" variant="booking" disabled={loading}>
            <Search className="h-4 w-4 mr-1" />
            {loading ? "Searching..." : "Look Up"}
          </Button>
        </form>

        {searched && !loading && bookings.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <p className="text-muted-foreground">No bookings found for this email address.</p>
            <p className="text-xs text-muted-foreground">Make sure you're using the same email you booked with.</p>
          </div>
        )}

        {bookings.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              Found {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
            </p>
            {bookings.map((b) => {
              const isPast = new Date(`${b.meeting_date}T23:59:59`) < new Date();
              const isCancelled = b.status === "cancelled";

              return (
                <div
                  key={b.id}
                  className={`rounded-xl border p-5 space-y-3 ${
                    isCancelled
                      ? "border-border bg-muted/30 opacity-60"
                      : isPast
                        ? "border-border bg-muted/20"
                        : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4 text-booking-hero" />
                        <span>{b.team_member_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 text-booking-hero" />
                        <span>{format(parseISO(b.meeting_date), "EEEE, MMMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 text-booking-hero" />
                        <span>{b.meeting_time} ({b.duration_minutes} min)</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {isCancelled ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                          <XCircle className="h-3 w-3" /> Cancelled
                        </span>
                      ) : isPast ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                          <CheckCircle className="h-3 w-3" /> Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-booking-success/10 text-booking-success">
                          <CheckCircle className="h-3 w-3" /> Confirmed
                        </span>
                      )}

                      {!isCancelled && !isPast && b.cancellation_token && (
                        <Link
                          to={`/cancel?token=${b.cancellation_token}`}
                          className="text-xs text-destructive hover:underline"
                        >
                          Cancel appointment
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground">Powered by Team Scheduler</p>
        </div>
      </div>
    </div>
  );
};

export default ManageBooking;
