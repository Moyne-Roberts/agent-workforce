/**
 * Debtor-email classifier.
 *
 * Pure, deterministic, language-aware (NL / FR / EN) rule set for first-pass
 * triage of incoming debtor mail. Output:
 *
 *   {
 *     category:    "auto_reply" | "ooo_temporary" | "ooo_permanent"
 *                | "payment_admittance" | "unknown",
 *     confidence:  0–1 (hand-assigned from observed precision),
 *     matchedRule: identifier of the rule that fired (for audit trails)
 *   }
 *
 * Rules are ordered; first match wins. Threshold + shadow-mode gating are
 * decisions for the orchestrator, NOT this function. See
 * docs/debtor-email-swarm-roadmap.md and docs/debtor-email-patterns.md.
 */

export type Category =
  | "auto_reply"
  | "ooo_temporary"
  | "ooo_permanent"
  | "payment_admittance"
  | "unknown";

export interface ClassifyInput {
  subject: string;
  from: string;
  bodySnippet?: string;
}

export interface ClassifyResult {
  category: Category;
  confidence: number;
  matchedRule: string;
}

// ───────────────────────────────────────────────────────────────── regexes ──

const SENDER_SYSTEM =
  /^(no\.?reply|no_reply|donotreply|mailer[-_]?daemon|postmaster|automailer|autoreply)@/i;

const SENDER_PAYMENT_ROLE =
  /^(payment|payments|invoice|invoices|facturen|facturatie|billing|accounting|accounts?[._-]?payable|betaal|betalingen|compte[._-]?client)@/i;

/** Detects a human-shape sender (firstname.lastname@ or firstname-lastname@). */
const SENDER_HUMAN_SHAPE = /^[a-z][a-z'-]*[._-][a-z][a-z'-]*@/i;

const SUBJECT_AUTO_REPLY =
  /(automatisch(?:e)?\s+antwoord|automatic\s+reply|auto[-\s]?reply|réponse\s+automatique|out\s+of\s+office|absence\s*:|afwezigheidsbericht|abwesenheits)/i;

/**
 * SUBJECT_PAYMENT is deliberately narrow: it must match only confirmation /
 * advice / receipt of payment, not the word "betaling" in any context. A
 * previous broader regex (just `betaling`) caught MR's own outbound dunning
 * template "VERZOEK TOT BETALING" (replies/forwards of it) and crashed
 * precision to 19%. Each term below was verified on the historical corpus.
 */
const SUBJECT_PAYMENT =
  /(betalingsadvies|betaal[-\s]?advies|betaalbevestiging|betalingsbevestiging|geregistreerde\s+betaling(?:en)?|betaling\s+ontvangen|ontvangen\s+betaling|payment\s+(?:advice|confirmation|details|notice|received|notification)|remittance\s+advice|avis\s+de\s+paiement|confirmation\s+de\s+paiement|zahlungsavis|zahlungsbest(?:ä|ae)tigung|zahlungseingang)/i;

/**
 * Subjects that look payment-related but are OUTBOUND dunning templates (or
 * replies to them). We must never classify these as payment_admittance —
 * they're the original payment REQUEST, not a confirmation.
 */
const SUBJECT_PAYMENT_REQUEST_BLOCK =
  /(verzoek\s+tot\s+betaling|request\s+for\s+payment|payment\s+request|rappel\s+de\s+paiement|demande\s+de\s+paiement|herinnering|reminder|mahnung|ingebreke)/i;

/**
 * Subjects that indicate refund / return of invoice — not an admittance of
 * incoming payment.
 */
const SUBJECT_REFUND_BLOCK =
  /(retour\s+van\s+factuur|creditnota|credit\s+note|refund|terugbetaling|terugstorting|remboursement)/i;

/** Mandatory exclusion — prevents payment_dispute from matching payment_admittance. */
const BODY_DISPUTE =
  /\b(dispute|disputed|complaint|missing|incorrect|betwist|contesteren|klacht|reclamatie|réclamation|contestation|foutief|onjuist|ontbreekt|error\s+in|wrong\s+amount)\b/i;

/** Subject-level dispute signals (can fire even if body is empty). */
const SUBJECT_DISPUTE =
  /(contesteren|betwisten|dispute|klacht|réclamation)/i;

/** Body signals — employee is temporarily away + has a return date. */
const BODY_OOO_TEMPORARY =
  /\b(terug\s+op|terug\s+vanaf|back\s+on|return\s+on|i\s+will\s+return|de\s+retour\s+le|je\s+serai\s+de\s+retour|vacation|congé|vacances|verlof|afwezig\s+(?:van|tot)|from\s+\d|van\s+\d{1,2}[-./]\d{1,2}|between\s+\d)/i;

/** Body signals — employee has left / redirect elsewhere permanently. */
const BODY_OOO_PERMANENT =
  /\b(no\s+longer\s+(?:works?|employed)|has\s+left\s+the\s+(?:company|organization)|niet\s+meer\s+(?:werkzaam|actief|in\s+dienst)|heeft\s+het\s+bedrijf\s+verlaten|ne\s+(?:travaille|fait)\s+plus\s+partie|please\s+(?:contact|redirect|reach\s+out\s+to)|gelieve\s+contact\s+op\s+te\s+nemen\s+met|veuillez\s+contacter)/i;

/** Generic OoO body signal (used to promote a subject-only auto_reply to OoO). */
const BODY_OOO_GENERIC =
  /\b(afwezig|ik\s+ben\s+afwezig|uit\s+kantoor|out\s+of\s+office|i\s+am\s+(?:away|out)|currently\s+out|absent\s+du|je\s+suis\s+absent|en\s+congé|in\s+vergadering|in\s+meeting)\b/i;

// ─────────────────────────────────────────────────────────────── classify ──

export function classify(input: ClassifyInput): ClassifyResult {
  const subject = input.subject ?? "";
  const from = input.from ?? "";
  const body = input.bodySnippet ?? "";

  // Strip leading Re:/Fw:/Tr: prefixes so subject regexes match.
  const normSubject = subject.replace(/^(?:(?:re|fw|fwd|tr|aw|sv|antw)\s*:\s*)+/i, "").trim();

  const isSystemSender = SENDER_SYSTEM.test(from);
  const isHumanSender = SENDER_HUMAN_SHAPE.test(from);
  const subjectIsAutoReply = SUBJECT_AUTO_REPLY.test(normSubject);
  const subjectIsPayment = SUBJECT_PAYMENT.test(normSubject);
  const senderIsPaymentRole = SENDER_PAYMENT_ROLE.test(from);
  const bodyDispute = BODY_DISPUTE.test(body);
  const subjectIsPaymentRequest = SUBJECT_PAYMENT_REQUEST_BLOCK.test(normSubject);
  const subjectIsRefund = SUBJECT_REFUND_BLOCK.test(normSubject);
  const subjectIsDispute = SUBJECT_DISPUTE.test(normSubject);

  // ── AUTO-REPLY / OoO family ────────────────────────────────────────────
  //
  // Promotion order: system sender is always `auto_reply` (never OoO — a
  // noreply@ address isn't a human on leave). Otherwise if the subject looks
  // like an auto-reply, we peek at the body to decide OoO temporary/permanent.

  if (isSystemSender) {
    return { category: "auto_reply", confidence: 0.98, matchedRule: "sender_system" };
  }

  if (subjectIsAutoReply) {
    // Try to promote to a more specific OoO label.
    if (BODY_OOO_PERMANENT.test(body)) {
      return { category: "ooo_permanent", confidence: 0.9, matchedRule: "subject_autoreply+body_permanent" };
    }
    if (BODY_OOO_TEMPORARY.test(body)) {
      return { category: "ooo_temporary", confidence: 0.9, matchedRule: "subject_autoreply+body_temporary" };
    }
    if (BODY_OOO_GENERIC.test(body) && isHumanSender) {
      // Generic OoO phrasing + human-shape sender but no clear return-vs-permanent
      // signal → conservative: treat as temporary (the more common case).
      // Lower confidence reflects the ambiguity.
      return { category: "ooo_temporary", confidence: 0.75, matchedRule: "subject_autoreply+body_ooo_generic+human_sender" };
    }
    // Subject says auto-reply but body gives no OoO signal → plain auto_reply.
    return { category: "auto_reply", confidence: 0.86, matchedRule: "subject_autoreply" };
  }

  // Body-only OoO signal (subject is generic): only accept if sender is human.
  if (isHumanSender && BODY_OOO_GENERIC.test(body)) {
    if (BODY_OOO_PERMANENT.test(body)) {
      return { category: "ooo_permanent", confidence: 0.85, matchedRule: "body_permanent+human_sender" };
    }
    if (BODY_OOO_TEMPORARY.test(body)) {
      return { category: "ooo_temporary", confidence: 0.8, matchedRule: "body_temporary+human_sender" };
    }
  }

  // ── PAYMENT_ADMITTANCE family ──────────────────────────────────────────
  //
  // Order matters: block subjects that LOOK payment-related but are actually
  // MR's own outbound dunning template coming back (verzoek tot betaling),
  // refunds/credit notes, or explicit disputes. Then apply positive rules.
  //
  // Sender-role alone is insufficient — `accounting@lidl.nl` + random subject
  // is not a payment confirmation. We require sender + confirming subject, or
  // a confirming subject on its own.

  if (subjectIsPaymentRequest) {
    return { category: "unknown", confidence: 0, matchedRule: "payment_blocked_request_template" };
  }
  if (subjectIsRefund) {
    return { category: "unknown", confidence: 0, matchedRule: "payment_blocked_refund" };
  }
  if (subjectIsDispute || bodyDispute) {
    if (senderIsPaymentRole || subjectIsPayment) {
      return { category: "unknown", confidence: 0, matchedRule: "payment_blocked_by_dispute" };
    }
  }

  if (senderIsPaymentRole && subjectIsPayment) {
    return { category: "payment_admittance", confidence: 0.94, matchedRule: "payment_sender+subject" };
  }
  if (subjectIsPayment) {
    return { category: "payment_admittance", confidence: 0.88, matchedRule: "payment_subject" };
  }
  // NOTE: sender-only (no matching subject) is intentionally NOT a match —
  // too many legitimate non-payment emails come from `accounting@…` / `facturen@…`.

  return { category: "unknown", confidence: 0, matchedRule: "no_match" };
}
