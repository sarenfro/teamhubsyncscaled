import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, Calendar, Lock } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center space-y-10">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Team Booking Pages</h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Create a shared booking page for your student team. Share the link so others can schedule
            meetings with your members.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 text-left">
          <div className="space-y-2 p-5 rounded-xl border border-border">
            <Users className="h-6 w-6 text-booking-hero" />
            <h3 className="font-semibold text-foreground">Team Profiles</h3>
            <p className="text-sm text-muted-foreground">
              Add all your team members and their availability calendars.
            </p>
          </div>
          <div className="space-y-2 p-5 rounded-xl border border-border">
            <Calendar className="h-6 w-6 text-booking-hero" />
            <h3 className="font-semibold text-foreground">Smart Scheduling</h3>
            <p className="text-sm text-muted-foreground">
              Real-time availability checks against your team's iCal calendars.
            </p>
          </div>
          <div className="space-y-2 p-5 rounded-xl border border-border">
            <Lock className="h-6 w-6 text-booking-hero" />
            <h3 className="font-semibold text-foreground">Shared Password</h3>
            <p className="text-sm text-muted-foreground">
              Protect your admin dashboard with a single shared team password.
            </p>
          </div>
        </div>

        <Button asChild variant="booking" size="lg">
          <Link to="/create">Create Your Team Page</Link>
        </Button>
      </div>
    </div>
  );
};

export default Landing;
