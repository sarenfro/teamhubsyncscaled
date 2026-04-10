
ALTER TABLE public.google_calendar_tokens 
ADD COLUMN IF NOT EXISTS team_member_id uuid REFERENCES public.team_members(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_team_member_id 
ON public.google_calendar_tokens(team_member_id);

ALTER TABLE public.google_calendar_tokens DROP CONSTRAINT IF EXISTS google_calendar_tokens_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_calendar_tokens_team_member_unique 
ON public.google_calendar_tokens(team_member_id) WHERE team_member_id IS NOT NULL;

CREATE POLICY "Team admins can view team member tokens"
ON public.google_calendar_tokens
FOR SELECT
TO authenticated
USING (
  team_member_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.team_admins ta ON ta.team_id = tm.team_id
    WHERE tm.id = google_calendar_tokens.team_member_id
    AND ta.user_id = auth.uid()
  )
);
