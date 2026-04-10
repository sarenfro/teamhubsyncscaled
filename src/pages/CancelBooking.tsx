import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

type State = "confirming" | "loading" | "success" | "already_cancelled" | "not_found" | "error";

const CancelBooking = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>("confirming");

  useEffect(() => {
    if (!token) setState("not_found");
  }, [token]);

  const handleCancel = async () => {
    if (!token) return;
    setState("loading");
    try {
      const { data, error } = await supabase.functions.invoke("cancel-booking", {
        body: { token },
      });
      if (error) throw error;
      if (data?.error === "Booking is already cancelled") {
        setState("already_cancelled");
      } else if (data?.error === "Booking not found") {
        setState("not_found");
      } else if (data?.error) {
        setState("error");
      } else {
        setState("success");
      }
    } catch {
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {state === "confirming" && (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Cancel Your Appointment?</h1>
              <p className="text-muted-foreground">
                This will cancel your scheduled meeting and notify the team. This action cannot be
                undone.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" asChild>
                <Link to="/">Never mind</Link>
              </Button>
              <Button variant="destructive" onClick={handleCancel}>
                Yes, cancel my appointment
              </Button>
            </div>
          </>
        )}

        {state === "loading" && (
          <>
            <Loader2 className="h-12 w-12 text-muted-foreground mx-auto animate-spin" />
            <p className="text-muted-foreground">Cancelling your appointment…</p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Appointment Cancelled</h1>
              <p className="text-muted-foreground">
                Your meeting has been cancelled and you'll receive a confirmation email shortly.
              </p>
            </div>
          </>
        )}

        {state === "already_cancelled" && (
          <>
            <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Already Cancelled</h1>
              <p className="text-muted-foreground">This appointment was already cancelled.</p>
            </div>
          </>
        )}

        {(state === "not_found" || state === "error") && (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Something Went Wrong</h1>
              <p className="text-muted-foreground">
                {state === "not_found"
                  ? "We couldn't find this appointment. The link may be invalid or expired."
                  : "Something went wrong. Please try again or contact the team directly."}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CancelBooking;
