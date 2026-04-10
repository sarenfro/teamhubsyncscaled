
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  ical_url text,
  color_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id),
  team_member_id uuid REFERENCES public.team_members(id),
  booker_name text NOT NULL,
  booker_email text NOT NULL,
  notes text,
  meeting_date date NOT NULL,
  meeting_time text NOT NULL,
  duration_minutes integer DEFAULT 30,
  status text DEFAULT 'confirmed',
  created_at timestamptz DEFAULT now()
);
