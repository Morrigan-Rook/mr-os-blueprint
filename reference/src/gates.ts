/**
 * GATES: rules the system enforces, not reminders in a prompt.
 *
 * A prompt can ask an agent to behave. A gate makes the wrong thing impossible
 * to save, send or run. Each gate returns a reason when it blocks, and the
 * reason is shown to the person and kept in the audit log.
 *
 * The three gates here mirror the ones that matter most in MR OS:
 *   - evidence: a high score needs a document or a system record behind it;
 *   - privacy: no agent processes client data before the account is opened;
 *   - outbound: no message leaves without opt-out, without unsourced figures
 *     and without an agent claiming to be human.
 */
import { type Db, parseJson } from "./db.ts";

export type GateResult = { ok: true } | { ok: false; reason: string };
const pass: GateResult = { ok: true };
const block = (reason: string): GateResult => ({ ok: false, reason });

/* ——— Evidence ——— */

/**
 * Scores run 0 to 4. A 3 or a 4 requires at least one piece of documentary or system evidence.
 * What an interviewee says, on its own, caps the score at 2. "Not measurable" is always allowed.
 */
export function evidenceGate(value: number | null, evidenceKinds: ("document" | "system" | "interview")[], notMeasurable = false): GateResult {
  if (notMeasurable) return pass;
  if (value === null || !Number.isInteger(value) || value < 0 || value > 4) return block("Score must be an integer from 0 to 4, or marked not measurable.");
  if (value >= 3 && !evidenceKinds.some((k) => k === "document" || k === "system")) return block("A 3 or a 4 needs a document or a system record. Interview statements alone cap at 2.");
  return pass;
}

export function saveScore(db: Db, s: { accountId: number; area: string; dimension: string; value: number | null; notMeasurable?: boolean; evidenceIds: number[]; decidedBy: string }): GateResult {
  const kinds = s.evidenceIds.length
    ? (db.prepare(`SELECT kind FROM evidence WHERE account_id = ? AND id IN (${s.evidenceIds.map(() => "?").join(",")})`).all(s.accountId, ...s.evidenceIds) as { kind: "document" | "system" | "interview" }[]).map((r) => r.kind)
    : [];
  const g = evidenceGate(s.value, kinds, s.notMeasurable);
  if (!g.ok) return g;
  db.prepare(
    `INSERT INTO scores (account_id, area, dimension, value, not_measurable, evidence_ids, decided_by) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_id, area, dimension) DO UPDATE SET value = excluded.value, not_measurable = excluded.not_measurable, evidence_ids = excluded.evidence_ids, decided_by = excluded.decided_by`,
  ).run(s.accountId, s.area, s.dimension, s.notMeasurable ? null : s.value, s.notMeasurable ? 1 : 0, JSON.stringify(s.evidenceIds), s.decidedBy);
  return pass;
}

/* ——— Privacy ——— */

/** Every item must be true before any agent touches the client's data. */
export const OPENING_CHECKLIST = ["contract_signed", "nda_signed", "data_processing_agreement_signed", "data_subject_authorization_declared", "deposit_received", "founder_approved"] as const;

export function privacyGate(db: Db, accountId: number): GateResult {
  const row = db.prepare("SELECT opening FROM accounts WHERE id = ?").get(accountId) as { opening: string } | undefined;
  if (!row) return block("Unknown account.");
  const opening = parseJson<Record<string, boolean>>(row.opening, {});
  const missing = OPENING_CHECKLIST.filter((k) => !opening[k]);
  return missing.length ? block(`Account opening incomplete: ${missing.join(", ")}.`) : pass;
}

/* ——— Outbound messages ——— */

const PRICE = /(?:US\$|\$|€|USD|EUR|COP)\s?\d|\d[\d.,]*\s?(?:USD|EUR|COP|dollars|euros)/i;
const HUMAN_CLAIM = /\b(I am|I'm) (a )?(real )?(human|person)\b|\bsoy (una )?(persona|humana?)\b/i;
const PERCENT_WITHOUT_SOURCE = /\d+\s?%/;

/**
 * The code layer of the compliance check. It catches the obvious cases cheaply and deterministically;
 * an agent (and, for anything unusual, a person) reviews what passes.
 */
export function outboundGate(message: { text: string; channel: "email" | "linkedin" | "phone"; sourceNote?: string; firstInSequence?: boolean }): GateResult {
  if (PRICE.test(message.text)) return block("Prices are never quoted in outbound messages.");
  if (HUMAN_CLAIM.test(message.text)) return block("An agent never claims to be a person.");
  if (PERCENT_WITHOUT_SOURCE.test(message.text) && !message.sourceNote) return block("Every figure needs its source.");
  if (message.channel === "email" && message.firstInSequence && !/unsubscribe|darse de baja|no recibir|opt out/i.test(message.text)) return block("The first email of a sequence must offer an opt-out.");
  return pass;
}
