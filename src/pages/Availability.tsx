import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIMES = (() => {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return times;
})();

const formatTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
};

interface DaySchedule {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

const DEFAULT_SCHEDULE: DaySchedule[] = DAYS.map((_, i) => ({
  day_of_week: i,
  start_time: "09:00",
  end_time: "17:00",
  is_available: i >= 1 && i <= 5, // Mon-Fri
}));

const Availability = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    const load = async () => {
      const { data } = await supabase
        .from("availability_schedules")
        .select("id, day_of_week, start_time, end_time, is_available")
        .eq("user_id", user.id)
        .order("day_of_week");

      if (data && data.length > 0) {
        setSchedule(
          DAYS.map((_, i) => {
            const existing = data.find((d) => d.day_of_week === i);
            if (existing) {
              return {
                id: existing.id,
                day_of_week: i,
                start_time: existing.start_time.slice(0, 5),
                end_time: existing.end_time.slice(0, 5),
                is_available: existing.is_available ?? true,
              };
            }
            return DEFAULT_SCHEDULE[i];
          })
        );
        setHasExisting(true);
      }
      setLoading(false);
    };
    load();
  }, [user, authLoading]);

  const handleToggle = (dayIndex: number) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day_of_week === dayIndex ? { ...d, is_available: !d.is_available } : d))
    );
  };

  const handleTimeChange = (dayIndex: number, field: "start_time" | "end_time", value: string) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day_of_week === dayIndex ? { ...d, [field]: value } : d))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (hasExisting) {
        // Update existing rows
        for (const day of schedule) {
          if (day.id) {
            await supabase
              .from("availability_schedules")
              .update({
                start_time: day.start_time,
                end_time: day.end_time,
                is_available: day.is_available,
              })
              .eq("id", day.id);
          } else {
            await supabase.from("availability_schedules").insert({
              user_id: user!.id,
              day_of_week: day.day_of_week,
              start_time: day.start_time,
              end_time: day.end_time,
              is_available: day.is_available,
            });
          }
        }
      } else {
        // Insert all
        const rows = schedule.map((d) => ({
          user_id: user!.id,
          day_of_week: d.day_of_week,
          start_time: d.start_time,
          end_time: d.end_time,
          is_available: d.is_available,
        }));
        await supabase.from("availability_schedules").insert(rows);
        setHasExisting(true);
      }
      toast({ title: "Saved", description: "Your availability has been updated." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/dashboard")}>
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Availability</h1>
          <p className="text-sm text-muted-foreground">Set your weekly working hours</p>
        </div>

        <div className="rounded-xl border border-border divide-y divide-border">
          {schedule.map((day) => (
            <div key={day.day_of_week} className="flex items-center gap-4 p-4">
              <Switch
                checked={day.is_available}
                onCheckedChange={() => handleToggle(day.day_of_week)}
              />
              <span className={`w-24 text-sm font-medium ${day.is_available ? "text-foreground" : "text-muted-foreground"}`}>
                {DAYS[day.day_of_week]}
              </span>
              {day.is_available ? (
                <div className="flex items-center gap-2 flex-1">
                  <Select value={day.start_time} onValueChange={(v) => handleTimeChange(day.day_of_week, "start_time", v)}>
                    <SelectTrigger className="w-[120px] text-sm">
                      <SelectValue>{formatTime(day.start_time)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {TIMES.map((t) => (
                        <SelectItem key={t} value={t}>{formatTime(t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-sm">–</span>
                  <Select value={day.end_time} onValueChange={(v) => handleTimeChange(day.day_of_week, "end_time", v)}>
                    <SelectTrigger className="w-[120px] text-sm">
                      <SelectValue>{formatTime(day.end_time)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {TIMES.map((t) => (
                        <SelectItem key={t} value={t}>{formatTime(t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Unavailable</span>
              )}
            </div>
          ))}
        </div>

        <Button variant="booking" size="lg" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Availability"}
        </Button>
      </div>
    </div>
  );
};

export default Availability;
