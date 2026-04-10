
-- 1. Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Create team_admins junction table
CREATE TABLE public.team_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, team_id)
);

ALTER TABLE public.team_admins ENABLE ROW LEVEL SECURITY;

-- Security definer function to check team admin membership
CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_admins
    WHERE user_id = _user_id AND team_id = _team_id
  );
$$;

CREATE POLICY "Users can view their own team associations"
  ON public.team_admins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert team associations for themselves"
  ON public.team_admins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Team owners can manage admins"
  ON public.team_admins FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_admins ta
      WHERE ta.team_id = team_admins.team_id
        AND ta.user_id = auth.uid()
        AND ta.role = 'owner'
    )
  );

-- 3. Add created_by and claim_token to teams
ALTER TABLE public.teams ADD COLUMN created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.teams ADD COLUMN claim_token UUID DEFAULT gen_random_uuid();

-- 4. Update teams RLS - allow admins to update their teams
CREATE POLICY "Team admins can update their teams"
  ON public.teams FOR UPDATE
  USING (public.is_team_admin(auth.uid(), id));

-- 5. Update team_members RLS to be scoped to team admins for write operations
-- Drop existing overly permissive policies and replace
DROP POLICY IF EXISTS "Allow public insert on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Allow public update on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Allow public delete on team_members" ON public.team_members;

CREATE POLICY "Team admins can insert members"
  ON public.team_members FOR INSERT
  WITH CHECK (public.is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can update members"
  ON public.team_members FOR UPDATE
  USING (public.is_team_admin(auth.uid(), team_id));

CREATE POLICY "Team admins can delete members"
  ON public.team_members FOR DELETE
  USING (public.is_team_admin(auth.uid(), team_id));

-- 6. Tighten bookings write policies
DROP POLICY IF EXISTS "Allow public update on bookings" ON public.bookings;

CREATE POLICY "Team admins can update bookings"
  ON public.bookings FOR UPDATE
  USING (public.is_team_admin(auth.uid(), team_id));

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
