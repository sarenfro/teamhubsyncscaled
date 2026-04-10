-- Allow anyone to read teams (public booking pages)
CREATE POLICY "Allow public read access on teams"
ON public.teams FOR SELECT
USING (true);

-- Allow anyone to read team members (public booking pages)
CREATE POLICY "Allow public read access on team_members"
ON public.team_members FOR SELECT
USING (true);

-- Allow anyone to read bookings (for availability checking)
CREATE POLICY "Allow public read access on bookings"
ON public.bookings FOR SELECT
USING (true);

-- Allow anyone to insert bookings (public booking form)
CREATE POLICY "Allow public insert on bookings"
ON public.bookings FOR INSERT
WITH CHECK (true);

-- Allow anyone to insert teams (create team flow)
CREATE POLICY "Allow public insert on teams"
ON public.teams FOR INSERT
WITH CHECK (true);

-- Allow anyone to insert team members (create team flow)
CREATE POLICY "Allow public insert on team_members"
ON public.team_members FOR INSERT
WITH CHECK (true);

-- Allow anyone to update team members (admin manages members)
CREATE POLICY "Allow public update on team_members"
ON public.team_members FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow anyone to delete team members (admin manages members)
CREATE POLICY "Allow public delete on team_members"
ON public.team_members FOR DELETE
USING (true);

-- Allow anyone to update bookings (for cancellation)
CREATE POLICY "Allow public update on bookings"
ON public.bookings FOR UPDATE
USING (true)
WITH CHECK (true);