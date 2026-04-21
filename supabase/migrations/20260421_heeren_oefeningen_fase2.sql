-- =============================================
-- Migration: Heeren Oefeningen Fase 2 — maandelijkse facturatie velden
-- Purpose: Breid heeren_oefeningen_staging uit met velden die nodig zijn
--          om aan het einde van de maand een nieuwe NXT order (draft)
--          aan te maken voor de verwijderde oefening-regels.
-- Context: Fase 1 (delete-order-line) blijft functioneel; de nieuwe kolommen
--          worden gevuld bij nieuwe Zapier webhook calls zodra de SQL query
--          aan hun kant is uitgebreid. Oude staging records zonder deze data
--          worden door Fase 2 overgeslagen.
-- =============================================

-- 1. Fase 1 data — vastleggen tijdens het triggeren van de delete
--    (deze velden komen mee uit de Zapier SQL query in de NXT productie DB)
ALTER TABLE heeren_oefeningen_staging
  ADD COLUMN IF NOT EXISTS customer_id    TEXT,    -- NXT customer ID (bijv. "200007")
  ADD COLUMN IF NOT EXISTS site_id        TEXT,    -- NXT site ID (bijv. "318887")
  ADD COLUMN IF NOT EXISTS brand_id       TEXT,    -- NXT brand/company ID (bijv. "SB")
  ADD COLUMN IF NOT EXISTS order_type_id  TEXT,    -- NXT order type (bijv. "DO")
  ADD COLUMN IF NOT EXISTS quantity       NUMERIC, -- aantal
  ADD COLUMN IF NOT EXISTS unit_price     NUMERIC, -- stuksprijs
  ADD COLUMN IF NOT EXISTS description    TEXT;    -- regel-beschrijving

-- 2. Fase 2 resultaat — gevuld door de maandelijkse cron
ALTER TABLE heeren_oefeningen_staging
  ADD COLUMN IF NOT EXISTS new_order_uuid           TEXT,         -- NXT interne UUID van de nieuwe order
  ADD COLUMN IF NOT EXISTS invoice_draft_created_at TIMESTAMPTZ,  -- tijdstip van draft-creatie
  ADD COLUMN IF NOT EXISTS invoice_draft_screenshot TEXT,         -- Supabase Storage URL
  ADD COLUMN IF NOT EXISTS invoice_error            TEXT;         -- laatste fout bij Fase 2 poging

-- Kolom new_billing_order_code bestaat al — die gebruiken we voor de nieuwe order code.

-- 3. Index voor de Fase 2 selectie-query:
--    "Welke processed records moeten nog gefactureerd worden?"
CREATE INDEX IF NOT EXISTS idx_heeren_staging_fase2_pending
  ON heeren_oefeningen_staging (processed_at)
  WHERE status = 'processed'
    AND new_billing_order_code IS NULL
    AND invoice_draft_created_at IS NULL;

-- 4. Index voor groepering per billing_order_code tijdens Fase 2
CREATE INDEX IF NOT EXISTS idx_heeren_staging_billing_order_code
  ON heeren_oefeningen_staging (billing_order_code);
