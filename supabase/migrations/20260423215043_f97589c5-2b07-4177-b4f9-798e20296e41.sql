-- 1. Add ical_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ical_url TEXT;

-- 2. Trigger: when a team_member is inserted/updated, if ical_url is empty
--    and email matches a profile, populate from that profile.
CREATE OR REPLACE FUNCTION public.populate_team_member_ical_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.ical_url IS NULL OR NEW.ical_url = '') AND NEW.email IS NOT NULL AND NEW.email <> '' THEN
    SELECT p.ical_url INTO NEW.ical_url
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE lower(u.email) = lower(NEW.email)
      AND p.ical_url IS NOT NULL
      AND p.ical_url <> ''
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_team_member_ical ON public.team_members;
CREATE TRIGGER trg_populate_team_member_ical
BEFORE INSERT OR UPDATE OF email ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.populate_team_member_ical_from_profile();

-- 3. Trigger: when a profile's ical_url is set/updated, backfill onto
--    that user's existing team_members rows that have no ical_url yet.
CREATE OR REPLACE FUNCTION public.backfill_team_member_ical_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  IF NEW.ical_url IS NULL OR NEW.ical_url = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.ical_url IS NOT DISTINCT FROM OLD.ical_url THEN
    RETURN NEW;
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
  IF user_email IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.team_members
  SET ical_url = NEW.ical_url
  WHERE lower(email) = lower(user_email)
    AND (ical_url IS NULL OR ical_url = '');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_backfill_team_member_ical ON public.profiles;
CREATE TRIGGER trg_backfill_team_member_ical
AFTER INSERT OR UPDATE OF ical_url ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.backfill_team_member_ical_from_profile();