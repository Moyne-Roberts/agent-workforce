/**
 * iController mailbox IDs per Moyne Roberts brand.
 *
 * Source: URL pattern https://walkerfire.icontroller.eu/messages/index/mailbox/{id}
 * Captured manually 2026-04-23. Keep in sync with Zapier per-mailbox Zaps;
 * each Zap sends the corresponding `icontroller_mailbox_id` in its payload.
 */
export const ICONTROLLER_MAILBOXES = {
  "debiteuren@smeba.nl": 4,
  "debiteuren@berki.nl": 171,
  "debiteuren@sicli-noord.nl": 15,
  "debiteuren@sicli-sud.nl": 16,
  "debiteuren@smeba-fire.nl": 5,
} as const;

export type SourceMailbox = keyof typeof ICONTROLLER_MAILBOXES;

export function isKnownMailbox(s: string): s is SourceMailbox {
  return s in ICONTROLLER_MAILBOXES;
}
