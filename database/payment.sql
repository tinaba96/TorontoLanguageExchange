-- =====================================
-- Payment columns for bookings (Stripe integration)
--
-- Split policy (per the product requirement):
--   teacher_payout_amount = 70% of price_at_booking
--   platform_amount       = 15% of price_at_booking
--   system_amount         = 15% of price_at_booking
--     ^- absorbs Stripe processing fees (~2.9% + $0.30 / charge);
--        the leftover is the platform's infrastructure margin.
--
-- All amounts are integers in cents (CAD), same convention as price_at_booking.
-- Rounding rule used in the API layer:
--   teacher = floor(price * 0.70)
--   platform = floor(price * 0.15)
--   system  = price - teacher - platform   (catches the 1-cent rounding residue)
-- =====================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS teacher_payout_amount   integer,
  ADD COLUMN IF NOT EXISTS platform_amount         integer,
  ADD COLUMN IF NOT EXISTS system_amount           integer,
  ADD COLUMN IF NOT EXISTS paid_at                 timestamptz;

-- Extend the status whitelist to include 'paid' (post-payment) and 'refunded'.
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending_payment', 'paid', 'confirmed', 'cancelled', 'refunded'));

CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment_intent
  ON public.bookings(stripe_payment_intent_id);
