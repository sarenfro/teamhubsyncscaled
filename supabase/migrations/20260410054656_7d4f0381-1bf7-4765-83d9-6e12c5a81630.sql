
-- 1. Availability schedules (weekly recurring)
CREATE TABLE public.availability_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_of_week)
);

ALTER TABLE public.availability_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own availability"
  ON public.availability_schedules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view availability for booking"
  ON public.availability_schedules FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own availability"
  ON public.availability_schedules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own availability"
  ON public.availability_schedules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own availability"
  ON public.availability_schedules FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Availability overrides (date-specific)
CREATE TABLE public.availability_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, override_date)
);

ALTER TABLE public.availability_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own overrides"
  ON public.availability_overrides FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view overrides for booking"
  ON public.availability_overrides FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own overrides"
  ON public.availability_overrides FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own overrides"
  ON public.availability_overrides FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own overrides"
  ON public.availability_overrides FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Add scheduling settings to event_types
ALTER TABLE public.event_types ADD COLUMN buffer_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.event_types ADD COLUMN min_notice_minutes INTEGER NOT NULL DEFAULT 240;
ALTER TABLE public.event_types ADD COLUMN max_days_advance INTEGER NOT NULL DEFAULT 60;
