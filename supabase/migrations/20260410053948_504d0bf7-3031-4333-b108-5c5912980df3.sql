
-- 1. Update profiles with personal slug and timezone
ALTER TABLE public.profiles ADD COLUMN slug TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles';

-- 2. Create event_types table
CREATE TABLE public.event_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  location_type TEXT DEFAULT 'google_meet',
  location_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT event_type_has_owner CHECK (
    (owner_user_id IS NOT NULL AND owner_team_id IS NULL) OR
    (owner_user_id IS NULL AND owner_team_id IS NOT NULL)
  ),
  UNIQUE(owner_user_id, slug),
  UNIQUE(owner_team_id, slug)
);

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;

-- Anyone can view active event types (for booking pages)
CREATE POLICY "Anyone can view active event types"
  ON public.event_types FOR SELECT
  USING (is_active = true);

-- Owners can view all their event types (including inactive)
CREATE POLICY "Users can view own event types"
  ON public.event_types FOR SELECT
  USING (auth.uid() = owner_user_id);

-- Team admins can view team event types
CREATE POLICY "Team admins can view team event types"
  ON public.event_types FOR SELECT
  USING (public.is_team_admin(auth.uid(), owner_team_id));

-- Users can manage their own event types
CREATE POLICY "Users can insert own event types"
  ON public.event_types FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own event types"
  ON public.event_types FOR UPDATE
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own event types"
  ON public.event_types FOR DELETE
  USING (auth.uid() = owner_user_id);

-- Team admins can manage team event types
CREATE POLICY "Team admins can insert team event types"
  ON public.event_types FOR INSERT
  WITH CHECK (public.is_team_admin(auth.uid(), owner_team_id));

CREATE POLICY "Team admins can update team event types"
  ON public.event_types FOR UPDATE
  USING (public.is_team_admin(auth.uid(), owner_team_id));

CREATE POLICY "Team admins can delete team event types"
  ON public.event_types FOR DELETE
  USING (public.is_team_admin(auth.uid(), owner_team_id));

-- 3. Add event_type_id to bookings
ALTER TABLE public.bookings ADD COLUMN event_type_id UUID REFERENCES public.event_types(id);

-- 4. Trigger for updated_at on event_types
CREATE TRIGGER update_event_types_updated_at
  BEFORE UPDATE ON public.event_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
