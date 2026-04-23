-- Migration: velden aligneren met Zapier Klachtenformulier
-- Created: 2026-04-23
-- Purpose: vorm de klachten tabel naar de werkelijke form-velden.
-- Form kan zowel door interne als externe partijen ingevuld worden —
-- we nemen veldnamen letterlijk over zonder interpretatie.

ALTER TABLE public.klachten
  DROP COLUMN IF EXISTS klant_email,
  DROP COLUMN IF EXISTS klant_telefoon,
  ADD COLUMN IF NOT EXISTS naam                 TEXT,
  ADD COLUMN IF NOT EXISTS email                TEXT,
  ADD COLUMN IF NOT EXISTS reactie_front_office TEXT;

-- RLS: sta INSERT toe vanuit Zapier via service_role.
DROP POLICY IF EXISTS "klachten_insert_service" ON public.klachten;
CREATE POLICY "klachten_insert_service"
  ON public.klachten
  FOR INSERT
  TO service_role
  WITH CHECK (true);
