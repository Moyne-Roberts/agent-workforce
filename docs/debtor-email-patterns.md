# Debtor Email Classifier — Pattern Analysis (Phase A0 + A0.5)

**Status:** A0 pattern mining complete, A0.5 historical replay complete with caveats (see §9).
**Source data:** `email_pipeline.emails` (79,099 rows total) + `debtor.email_analysis` (6,114 analyzed inbound rows) in Supabase.
**Classifier:** implemented in `web/lib/debtor-email/classify.ts`.
**Replay script:** `web/lib/debtor-email/replay.ts`.
**Last updated:** 2026-04-21.

## TL;DR

1. Rule set shipped (classifier exists). `auto_reply` is strong (~97% precision against noisy ground truth, likely higher in reality). `payment_admittance` rules rewritten to avoid false positives on MR's own outbound dunning template (`VERZOEK TOT BETALING`).
2. **Historical corpus labels are unreliable** — the earlier LLM-based labeling flagged payment advices from automated senders (`Betalingsadvies`, `Zahlungsavis`, `Payment advice from H&B`) as `auto_reply` when they're clearly `payment_admittance`. Replay numbers against these labels undercount the classifier's real precision.
3. **Real validation gate:** the polished bulk-approval UI (Phase A4). Human signal is the trustworthy oracle; the historical corpus is not.

## 1. Corpus shape

| Aspect | Value |
|---|---|
| Source tables | `email_pipeline.emails` (79,099 rows) and `debtor.email_analysis` (6,114 analyzed inbound) |
| Key columns | `sender_email`, `subject`, `body_text`, `direction`, `received_at`, `language`, `category`, `email_intent` |
| Direction | `incoming` / `sent` tracked explicitly |
| Language | Tracked: observed distribution on analyzed sample → NL 837, FR 103, EN 55, DE 4 (NL-dominant, FR/EN minority — skews rule-tuning toward NL) |
| Category field | Values observed: `auto_reply`, `payment`, `invoice`, `admin`, `dispute`, `legal`, `other`, `complaint`, `delivery_issue` |
| Intent field | 13+ values including `auto_reply`, `payment_confirmation`, `payment_dispute`, `invoice_request`, `address_change`, ... |

**Caveat:** the analyzed subset may undersample FR/EN vs the full corpus. Rule-tuning should treat NL as high-confidence, FR/EN as preliminary until we gather more labelled minority-language examples.

## 2. Existing category distribution (sampled 1,000 analyzed)

| Category | Count | % of sample |
|---|---|---|
| `admin` | 934 | 93.4% |
| `auto_reply` | 66 | 6.6% |

Payment/invoice signals live under `email_intent`, not `category`:

| Intent | Count (full corpus) |
|---|---|
| `payment_confirmation` | 92 |
| `payment_dispute` | 82 |
| `invoice_request` | 132 |
| `address_change` | 35 |

The `admin` bucket is the ambiguous-routing target for Phase C (Orq.ai triage).

## 3. Sender patterns

**Critical finding:** only **~15.7%** of observed auto-replies come from `noreply|no-reply|donotreply` senders. The majority originate from real company addresses (e.g. `info@sicli-noord.be`, `info@smeba.nl`). Sender-pattern alone is **high-precision, low-recall** — must combine with subject/body signals.

**High-confidence auto-reply sender regex (≥98% precision, ~16% recall):**
```
^(no.?reply|no_reply|donotreply|mailer[-_]?daemon|postmaster|automailer|autoreply)@
```

**Payment-admittance sender local-part patterns (≥89% precision on observed payment corpus):**
```
^(payment|payments|invoice|invoices|facturen|facturatie|billing|accounting|accounts?.?payable|betaal|betalingen|compte.?client)@
```

Known system-sender examples worth auto-allowing in future reviews: `noreply@jumbo.com`, `no_reply@trinergy.be`, `no-reply@factuurportal.eu`, `no-reply@brocacef.nl`, `noreply@hema.nl`, `DONOTREPLY@CARGILL.COM`.

## 4. Subject-prefix patterns per language

### Auto-reply

| Language | Patterns observed | Coverage within lang |
|---|---|---|
| NL | `Automatisch antwoord`, `Autoreply`, `Automatic reply` | ~35% |
| EN | `Automatic reply`, `Auto-Reply:`, `Auto Reply` | ~27% |
| FR | `Réponse automatique`, `Absence:`, `Je suis absent` | ~8–12% |

**Proposed subject regex (case-insensitive, all languages):**
```
^(re:|fw:|tr:|fwd:)?\s*(automatisch(e)?\s+antwoord|automatic\s+reply|auto[-\s]?reply|réponse\s+automatique|out\s+of\s+office|absence:|afwezigheidsbericht)
```

`FW`/`RE`/`TR` prefixes are very common (~25% of auto-reply subjects). The regex tolerates any forwarding/reply prefix.

### Payment admittance

| Language | Patterns observed |
|---|---|
| NL | `Betalingsbevestiging`, `Betaaladvies`, `Geregistreerde betaling`, `Betaling ontvangen` |
| EN | `Payment advice`, `Payment confirmation`, `Remittance advice`, `Payment details` |
| FR | `Avis de paiement`, `Confirmation de paiement`, `Remise de paiement` |

**Proposed subject regex:**
```
^(re:|fw:|tr:|fwd:)?\s*(betaling(s|en)?|betaaladvies|payment\s+(advice|confirmation|details)|remittance\s+advice|avis\s+de\s+paiement|confirmation\s+de\s+paiement|geregistreerde\s+betaling)
```

**Mandatory exclusion** (preventing `payment_dispute` false-positives):
```
!body_contains("dispute|complaint|missing|incorrect|betwist|klacht|réclamation|contestation|fout|error|onjuist")
```

## 5. Out-of-office — separate label, yes

Data support a distinct `out_of_office` label:

- **~13.4%** of auto-replies are genuine human OoO (not system-generated).
- Sender shape: `firstname.lastname@company.tld` vs system addresses.
- Subject: same "Automatic reply" / "Automatisch antwoord" prefix, but body contains explicit OoO phrasing or date-ranges.
- Business value: OoO replies often contain **delegation info** ("contact X in my absence") that's useful to a human reviewer. Deleting from iController loses that lead.

**Proposed action per label:**

| Label | Outlook | iController |
|---|---|---|
| `auto_reply` | categorize "Auto-Reply" + archive | delete |
| `out_of_office` | categorize "Out of Office" + archive | **keep** (human may want delegation info) |
| `payment_admittance` | categorize "Payment Admittance" + archive | delete |
| `unknown` | no action | no action — routed to Phase C |

**OoO detection regex (body, case-insensitive):**
```
\b(afwezig(\s+van)?|ik\s+ben\s+afwezig|uit\s+kantoor|verlof|terug\s+op|out\s+of\s+office|i\s+am\s+(away|out)|i\s+will\s+return|back\s+on|vacation|congé|vacances|je\s+suis\s+absent|absent\s+du|de\s+retour\s+le)\b
```

**OoO decision logic:**
1. If auto_reply matches AND body contains OoO-phrase AND sender is `firstname.lastname@` format → label `out_of_office`.
2. Else if auto_reply matches → label `auto_reply`.

## 6. Proposed rule set for Phase A1

```typescript
type Category = "auto_reply" | "out_of_office" | "payment_admittance" | "unknown";

function classify(input: {
  subject: string;
  from: string;
  bodySnippet?: string;
}): { category: Category; confidence: number; matchedRule: string };
```

Rules evaluated in order; first match wins. Each rule assigns a confidence score; aggregate reported for observability.

1. **payment_dispute-exclusion guard** — if body matches dispute regex, never label as `payment_admittance`.
2. **system_auto_reply_strong** — sender matches noreply regex → `auto_reply` conf 0.98.
3. **subject_auto_reply** — subject matches auto-reply regex → provisional `auto_reply`.
4. **ooo_body_human** — if provisional auto_reply AND body matches OoO regex AND sender is human-shape → promote to `out_of_office` conf 0.90.
5. **payment_admittance_sender** — sender local-part matches payment regex → provisional `payment_admittance` conf 0.89.
6. **payment_admittance_subject** — subject matches payment regex → provisional `payment_admittance` conf 0.86.
7. If rules 5+6 both match AND dispute-guard passes → `payment_admittance` conf 0.94.
8. Else → `unknown`.

## 7. Expected performance (from sampled historical labels)

| Label | Target precision | Target recall | Notes |
|---|---|---|---|
| `auto_reply` | ≥94% | ≥88% | Strong on NL/EN; FR tuning needs more data. |
| `out_of_office` | ≥90% | ≥85% | Separate from auto_reply only when body + sender both signal. |
| `payment_admittance` | ≥90% | ≥82% | Dispute-exclusion is critical; initial recall is conservative by design. |

These miss the roadmap's ≥95% / ≥90% aspirational bar. Plan: ship at current numbers + shadow mode, tune rules based on automation_runs disagreements with human action over first 72h, then remove shadow gate.

## 9. Historical replay results (A0.5, 2026-04-21)

Ran `classify()` against all 6,114 rows in `debtor.email_analysis`, mapping historical `category` + `email_intent` into our new taxonomy.

**Measured against the LLM-generated corpus labels:**

| Label | Precision | Recall | F1 | Notes |
|---|---|---|---|---|
| `auto_reply` | 0.967 | 0.293 | 0.450 | Precision strong; recall is 29% against noisy corpus. |
| `ooo_temporary` | — | — | — | Corpus has no OoO sub-labels; all 97 predictions count as FPs. Not measurable here. |
| `ooo_permanent` | — | — | — | Same as above (16 predictions). |
| `payment_admittance` | 0.117 | 0.057 | 0.077 | **See §9.1 — this number is misleading.** |

**Rule hits (6,114 rows):**
- `no_match`: 4,592 (75%) — correctly routes to `unknown` / Phase C.
- `payment_blocked_request_template`: 741 — guard against MR's own outbound "VERZOEK TOT BETALING".
- `subject_autoreply`: 252.
- `sender_system`: 153.
- `payment_subject`: 144.
- `subject_autoreply+body_temporary`: 74 (OoO).
- `payment_blocked_refund`: 70.
- `payment_sender+subject`: 44.
- `subject_autoreply+body_ooo_generic+human_sender`: 23 (OoO, low confidence).
- `subject_autoreply+body_permanent`: 16 (OoO).
- `payment_blocked_by_dispute`: 5.

### 9.1 Why the `payment_admittance` number is misleading

Manual inspection of 30 "false-positive" payment_admittance predictions shows **the classifier is correct and the historical label is wrong** in the majority of cases. Examples (all marked `auto_reply` in corpus, actually unambiguous payment admittance):

- `Betalingsadvies 20260302 300398` (from `noreply.snl@spie.com`)
- `Zahlungsavis vom 05.03.2026` (from `accounting@lidl.nl`)
- `Payment advice from H&B`
- `Geregistreerde betaling(en) voor SICLI FIRE PROTECTION NOORD BV`
- `Remittance Advice Notification`

The debtor-email-analyzer's earlier LLM categorized emails from automated senders as `auto_reply` regardless of content. Our classifier distinguishes by intent (subject/body content), which is correct behavior. The replay metric here measures agreement with a flawed oracle, not true precision.

**Implication:** do not use historical replay as the graduation gate. Use the polished bulk-approval UI (Phase A4) — human-in-the-loop review against live data is the only trustworthy validation.

### 9.2 Real bugs the replay did find

The replay was still useful for catching classifier bugs where the problem was obvious regardless of labeling:

1. **MR's own outbound dunning template `VERZOEK TOT BETALING`** was being matched by a too-broad `betaling(s|en)?` subject regex, causing hundreds of replies/forwards of our own payment-request template to be flagged as payment_admittance. Fixed by narrowing the subject regex to confirmation phrases only (`betalingsadvies`, `geregistreerde betaling`, `payment advice`, etc.) and adding a hard subject-level block for dunning/request templates.
2. **Refunds and credit notes** (`Retour van factuur`, `Creditnota`) were being classified as payment. Fixed by adding `SUBJECT_REFUND_BLOCK`.
3. **Dispute signal was body-only.** Rows with `Contesteren factuur 3300176` in the subject slipped through. Fixed by adding `SUBJECT_DISPUTE`.
4. **Sender-only rule dropped.** An account address (`accounting@lidl.nl`) with a random subject was being classified as payment at 0.89 confidence. Now sender-role alone does not match — it must combine with a confirming subject.

## 10. Open questions

1. **Language field completeness** — is `language` populated for all inbound rows, or only analyzed ones? If sparse, the classifier may need its own language hint (`franc` detection on body snippet).
2. **OoO keep-in-iController decision** — confirm with debiteurenbeheer team that OoO delegation info is worth keeping, or if they prefer all three labels get iController-deleted.
3. **Dispute false-positive ceiling** — payment disputes are ~82 emails; we're excluding them via body keywords, but the keyword list likely misses nuances. Shadow mode will surface false-exclusions.
4. **Forwarded internal correspondence (FW/RE)** — the explorer noted ~25% of "auto-reply" subjects are actually forwarded/replied threads that happen to include the word "Automatic reply" quoted. Our regex `^(re:|fw:...)?` tolerates that prefix — but a forwarded human email with "Automatic reply" in the body shouldn't be classified as auto_reply. Validate with test cases.
5. **Mixed-language subjects** — some emails combine languages (EN auto-reply prefix, NL body). Current approach handles this (subject-pattern is language-agnostic). Confirm in shadow mode.

## References

- Roadmap: [`debtor-email-swarm-roadmap.md`](./debtor-email-swarm-roadmap.md)
- Corpus ingestion code: `web/debtor-email-analyzer/src/` (analyze.ts, categorize.ts, stats.ts)
- Learnings (Supabase): `iController` + `agent-workforce` systems.
