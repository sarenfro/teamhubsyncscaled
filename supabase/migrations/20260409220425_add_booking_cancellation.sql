ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancellation_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_cancellation_token_idx
  ON public.bookings (cancellation_token);
