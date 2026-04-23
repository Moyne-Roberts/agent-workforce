/**
 * Extract NXT invoice number candidates from email subject + body.
 *
 * Known formats at Moyne Roberts (see sample in project description):
 *   17XXXXXX, 25XXXXXX, 30XXXXXX, 32XXXXXX, 33XXXXXX  (8 digits)
 *
 * False positives (dates, phone numbers, postal codes) are filtered by
 * validating each candidate against NXT's invoices table downstream —
 * only existing numbers resolve to a debtor. No extra heuristics here.
 */
const INVOICE_PATTERN = /\b(17|25|30|32|33)\d{6}\b/g;

export interface InvoiceExtract {
  candidates: string[];       // deduped, subject-first order preserved
  fromSubject: string[];      // higher confidence signal
  fromBody: string[];
}

export function extractInvoiceCandidates(
  subject: string | null | undefined,
  body: string | null | undefined,
): InvoiceExtract {
  const fromSubject = matchAll(subject ?? "");
  const fromBody = matchAll(body ?? "");
  const candidates = Array.from(new Set([...fromSubject, ...fromBody]));
  return { candidates, fromSubject, fromBody };
}

function matchAll(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(INVOICE_PATTERN)) out.push(m[0]);
  return out;
}
