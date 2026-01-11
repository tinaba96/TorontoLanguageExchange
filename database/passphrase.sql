-- =====================================
-- Passphrase Feature (合言葉)
-- Registration requires correct passphrase
-- Existing users need to re-verify when passphrase changes
-- =====================================

-- =====================================
-- 1. APP_SETTINGS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Insert default passphrase
INSERT INTO public.app_settings (key, value)
VALUES ('registration_passphrase', 'toronto2024')
ON CONFLICT (key) DO NOTHING;

-- Insert passphrase version (increments when passphrase changes)
INSERT INTO public.app_settings (key, value)
VALUES ('passphrase_version', '1')
ON CONFLICT (key) DO NOTHING;

-- Insert email verification setting (default: false - no email verification required)
INSERT INTO public.app_settings (key, value)
VALUES ('email_verification_required', 'false')
ON CONFLICT (key) DO NOTHING;

-- =====================================
-- 2. ADD PASSPHRASE VERSION TO PROFILES
-- =====================================

-- Add column to track which passphrase version user verified
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS passphrase_version integer DEFAULT 0;

-- =====================================
-- 2. ROW LEVEL SECURITY (RLS)
-- =====================================

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read passphrase (needed for signup validation)
DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Anyone can read app_settings"
  ON public.app_settings FOR SELECT
  USING (true);

-- Only admins can update settings
DROP POLICY IF EXISTS "Only admins can update app_settings" ON public.app_settings;
CREATE POLICY "Only admins can update app_settings"
  ON public.app_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Only admins can insert settings
DROP POLICY IF EXISTS "Only admins can insert app_settings" ON public.app_settings;
CREATE POLICY "Only admins can insert app_settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- =====================================
-- HOW TO CHANGE PASSPHRASE
-- =====================================
-- Run this query with the new passphrase:
--
-- UPDATE public.app_settings
-- SET value = 'new_passphrase_here', updated_at = now()
-- WHERE key = 'registration_passphrase';
--
-- =====================================
-- TO CHECK CURRENT PASSPHRASE
-- =====================================
-- SELECT value FROM public.app_settings
-- WHERE key = 'registration_passphrase';
-- =====================================
