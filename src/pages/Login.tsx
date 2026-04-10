import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";

const Login = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ slug, password }),
        },
      );
      const json = await res.json();
      if (json.success) {
        localStorage.setItem(
          `team_auth_${slug}`,
          JSON.stringify({ teamId: json.teamId, slug, authorized: true }),
        );
        navigate(`/admin/${slug}`);
      } else {
        setError("Incorrect password. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-booking-hero-light">
            <Lock className="h-6 w-6 text-booking-hero" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Team Login</h1>
          <p className="text-sm text-muted-foreground">
            Enter your team password to access the admin dashboard for{" "}
            <span className="font-medium text-foreground">{slug}</span>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Team password"
            required
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="booking" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? "Checking..." : "Log In"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Want to book a meeting?{" "}
          <Link to={`/book/${slug}`} className="text-booking-hero hover:underline">
            Book with this team
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
