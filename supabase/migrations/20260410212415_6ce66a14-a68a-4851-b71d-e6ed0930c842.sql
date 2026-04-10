
-- Allow team owners to update team_admins (e.g. change roles)
CREATE POLICY "Team owners can update admins"
ON public.team_admins
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.team_admins ta
    WHERE ta.team_id = team_admins.team_id
      AND ta.user_id = auth.uid()
      AND ta.role = 'owner'
  )
);
