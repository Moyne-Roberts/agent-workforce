-- Debtor email auto-labeling to iController debtor accounts.
--
-- Flow: Zapier (per Outlook mailbox) → Vercel /api/automations/debtor/label-email
--   1. Thread-inheritance lookup (email_pipeline.emails.conversation_id)
--   2. Invoice regex extract → NXT SQL lookup via Zapier → debtor_id
--   3. Sender email fallback → NXT SQL lookup
--   4. LLM tiebreaker (Orq.ai) on ambiguous cases
--   5. Browserless: navigate /messages/index/mailbox/{id}, find, label
--
-- Live activation lives in Zapier (on/off per mailbox). Vercel has only a
-- dry_run kill-switch in labeling_settings.

create schema if not exists debtor;

-- Per-email labeling decision + status audit.
create table if not exists debtor.email_labels (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null, -- email_pipeline.emails.id
  icontroller_mailbox_id int not null, -- source mailbox (4, 5, 15, 16, 171)
  source_mailbox text not null,        -- e.g. debiteuren@smeba.nl

  -- Resolution result
  debtor_id text,                      -- NXT debtor account id (null if unresolved)
  debtor_name text,
  conversation_id text,                -- Graph conversationId, denormalized for fast thread-inheritance joins
  confidence text not null check (confidence in ('high', 'medium', 'low', 'none')),
  method text not null check (method in (
    'thread_inheritance', 'invoice_match', 'sender_match', 'llm_tiebreaker', 'unresolved'
  )),
  reason text,                         -- human-readable explanation
  invoice_numbers text[],              -- regex matches that resolved
  ambiguous_candidates jsonb,          -- when multiple debtors possible

  -- Execution status
  status text not null check (status in (
    'pending', 'dry_run', 'labeled', 'skipped', 'failed'
  )) default 'pending',
  error text,
  screenshot_before text,              -- Supabase storage path
  screenshot_after text,

  created_at timestamptz not null default now(),
  labeled_at timestamptz
);

create index if not exists email_labels_email_id_idx on debtor.email_labels (email_id);
create index if not exists email_labels_status_idx on debtor.email_labels (status, created_at desc);
create index if not exists email_labels_mailbox_idx on debtor.email_labels (icontroller_mailbox_id, created_at desc);
create index if not exists email_labels_conversation_idx on debtor.email_labels (conversation_id) where conversation_id is not null and debtor_id is not null;

alter table debtor.email_labels enable row level security;

-- Per-mailbox kill-switch (Vercel-side). Live on/off sits in Zapier.
create table if not exists debtor.labeling_settings (
  source_mailbox text primary key,
  dry_run boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table debtor.labeling_settings enable row level security;

-- Seed default dry_run=true for all five mailboxes.
insert into debtor.labeling_settings (source_mailbox, dry_run) values
  ('debiteuren@smeba.nl', true),
  ('debiteuren@berki.nl', true),
  ('debiteuren@sicli-noord.nl', true),
  ('debiteuren@sicli-sud.nl', true),
  ('debiteuren@smeba-fire.nl', true)
on conflict (source_mailbox) do nothing;
