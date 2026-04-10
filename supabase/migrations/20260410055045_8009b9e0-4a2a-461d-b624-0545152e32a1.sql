
-- Phase 3: Google Calendar token storage
CREATE TABLE public.google_calendar_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens" ON public.google_calendar_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tokens" ON public.google_calendar_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tokens" ON public.google_calendar_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tokens" ON public.google_calendar_tokens FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_google_calendar_tokens_updated_at
  BEFORE UPDATE ON public.google_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 4: Assignment strategy on event types
ALTER TABLE public.event_types ADD COLUMN assignment_strategy TEXT NOT NULL DEFAULT 'none';

-- Phase 4: Routing forms
CREATE TABLE public.routing_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  event_type_id UUID REFERENCES public.event_types(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  owner_user_id UUID,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  routing_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.routing_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active routing forms" ON public.routing_forms FOR SELECT USING (is_active = true);
CREATE POLICY "Owners can manage routing forms" ON public.routing_forms FOR ALL USING (auth.uid() = owner_user_id);
CREATE POLICY "Team admins can manage team routing forms" ON public.routing_forms FOR ALL USING (is_team_admin(auth.uid(), team_id));

CREATE TRIGGER update_routing_forms_updated_at
  BEFORE UPDATE ON public.routing_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
