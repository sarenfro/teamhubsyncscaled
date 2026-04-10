
-- Allow team owners to delete their teams
CREATE POLICY "Team owners can delete teams"
ON public.teams
FOR DELETE
USING (is_team_admin(auth.uid(), id));

-- Allow team admins to delete their own team_admin association (leave team)
CREATE POLICY "Users can leave teams"
ON public.team_admins
FOR DELETE
USING (auth.uid() = user_id);

-- Cascade: when a team is deleted, remove its members
ALTER TABLE public.team_members
DROP CONSTRAINT IF EXISTS team_members_team_id_fkey;
ALTER TABLE public.team_members
ADD CONSTRAINT team_members_team_id_fkey
FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- Cascade: when a team is deleted, remove its admins
ALTER TABLE public.team_admins
DROP CONSTRAINT IF EXISTS team_admins_team_id_fkey;
ALTER TABLE public.team_admins
ADD CONSTRAINT team_admins_team_id_fkey
FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- Cascade: when a team is deleted, remove its bookings
ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_team_id_fkey;
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_team_id_fkey
FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- Cascade: when a team is deleted, remove its event types
ALTER TABLE public.event_types
DROP CONSTRAINT IF EXISTS event_types_owner_team_id_fkey;
ALTER TABLE public.event_types
ADD CONSTRAINT event_types_owner_team_id_fkey
FOREIGN KEY (owner_team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- Cascade: when a team is deleted, remove its routing forms
ALTER TABLE public.routing_forms
DROP CONSTRAINT IF EXISTS routing_forms_team_id_fkey;
ALTER TABLE public.routing_forms
ADD CONSTRAINT routing_forms_team_id_fkey
FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
