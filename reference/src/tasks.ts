/**
 * TASKS: the agent proposes, a person approves.
 *
 * A task is work given to an agent: a type, an input and a lifecycle.
 *
 *   blocked ─┐
 *   queued → running → awaiting_approval → approved | rejected
 *                    ↘ failed            ↘ done (types that need no approval)
 *
 * - A task that touches client data is created "blocked" until the privacy
 *   gate passes. Nothing reaches an engine before that.
 * - Every output records the agent version and the engine that produced it.
 * - Approving means "I sign this". Rejecting requires a note that says what
 *   was wrong. A correction is counted, so the human correction rate can be
 *   watched per agent.
 */
import { audit, type Db, parseJson } from "./db.ts";
import { countRun, type Engine, hasBudget } from "./engines.ts";
import { privacyGate } from "./gates.ts";
import { role } from "./team.ts";
import { extractJson, wrapUntrusted } from "./untrusted.ts";
import { agentInstructions, versionOf } from "./versioning.ts";

export type TaskType = {
  id: string;
  agent: string;
  description: string;
  output: "json" | "text";
  needsApproval: boolean;
  /** Set when the input includes client data: the task waits for the privacy gate. */
  clientDataAccount?: (input: Record<string, unknown>) => number | null;
  /** Build the instruction and the data the agent receives. */
  prepare: (input: Record<string, unknown>) => { instruction: string; data: unknown };
  /** Return an error message if the output is not usable. */
  validate?: (output: unknown) => string | null;
};

export const TASK_TYPES: TaskType[] = [
  {
    id: "review-application",
    agent: "intake-reviewer",
    description: "Candidate qualification of an inbound application",
    output: "json",
    needsApproval: true,
    prepare: (input) => ({
      instruction:
        'Score the application on the six axes (0-2 each). For every axis, quote the sentence that supports the score. Answer only JSON: {"axes": {"decision":n,"pain":n,"budget":n,"counterpart":n,"data":n,"openness":n}, "quotes": {...}, "disqualifiers": [..]}',
      data: input.application,
    }),
    validate: (o) => {
      const axes = (o as { axes?: Record<string, number> })?.axes;
      if (!axes) return "missing axes";
      return Object.values(axes).every((v) => Number.isInteger(v) && v >= 0 && v <= 2) ? null : "every axis must be 0, 1 or 2";
    },
  },
  {
    id: "draft-follow-up",
    agent: "follow-up-writer",
    description: "Follow-up draft for a prospect",
    output: "text",
    needsApproval: true,
    prepare: (input) => ({ instruction: "Write a short follow-up in the firm's voice. One question, no prices, no pressure.", data: input.thread }),
  },
  {
    id: "check-evidence",
    agent: "evidence-checker",
    description: "Confirm or reject a high score against its evidence",
    output: "json",
    needsApproval: false,
    clientDataAccount: (input) => Number(input.accountId) || null,
    prepare: (input) => ({ instruction: 'Answer only JSON: {"verdict":"CONFIRM"|"REJECT","reason":"one line"}', data: input.score }),
    validate: (o) => (["CONFIRM", "REJECT"].includes((o as { verdict?: string })?.verdict ?? "") ? null : "verdict must be CONFIRM or REJECT"),
  },
];

export const taskType = (id: string) => TASK_TYPES.find((t) => t.id === id);

export function createTask(db: Db, typeId: string, input: Record<string, unknown>, requestedBy: string): number {
  const t = taskType(typeId);
  if (!t) throw new Error(`Unknown task type ${typeId}`);
  const agent = role(db, t.agent);
  if (!agent || agent.kind !== "agent") throw new Error(`${t.agent} is not an agent`);
  let status = "queued";
  let reason: string | null = null;
  if (agent.status !== "active") [status, reason] = ["blocked", `Agent ${agent.name} is ${agent.status}.`];
  const accountId = t.clientDataAccount?.(input) ?? null;
  if (status === "queued" && accountId !== null) {
    const g = privacyGate(db, accountId);
    if (!g.ok) [status, reason] = ["blocked", g.reason];
  }
  const id = Number(
    db.prepare("INSERT INTO tasks (type, agent_id, input, status, blocked_reason, requested_by) VALUES (?, ?, ?, ?, ?, ?)").run(typeId, t.agent, JSON.stringify(input), status, reason, requestedBy).lastInsertRowid,
  );
  audit(db, requestedBy, "task_created", `task:${id}`, { type: typeId, status, reason });
  return id;
}

/** Re-check blocked tasks (for example after the account opening is completed). */
export function unblock(db: Db) {
  const blocked = db.prepare("SELECT id, type, input FROM tasks WHERE status = 'blocked'").all() as { id: number; type: string; input: string }[];
  for (const b of blocked) {
    const t = taskType(b.type)!;
    const agent = role(db, t.agent)!;
    const input = parseJson<Record<string, unknown>>(b.input, {});
    const accountId = t.clientDataAccount?.(input) ?? null;
    const ok = agent.status === "active" && (accountId === null || privacyGate(db, accountId).ok);
    if (ok) db.prepare("UPDATE tasks SET status = 'queued', blocked_reason = NULL WHERE id = ?").run(b.id);
  }
}

export function buildPrompt(t: TaskType, input: Record<string, unknown>, instructions: string): string {
  const { instruction, data } = t.prepare(input);
  return [instructions.trim(), "", "## Task", instruction, "", wrapUntrusted(t.id, data ?? {})].join("\n");
}

/** Run the oldest queued task. Returns its id, or null if there was nothing to do (or no budget). */
export async function runNext(db: Db, engines: Partial<Record<string, Engine>>): Promise<number | null> {
  const next = db.prepare("SELECT id, type, agent_id, input FROM tasks WHERE status = 'queued' ORDER BY id LIMIT 1").get() as
    | { id: number; type: string; agent_id: string; input: string }
    | undefined;
  if (!next) return null;
  const t = taskType(next.type)!;
  const agent = role(db, next.agent_id)!;
  const engine = engines[agent.engine ?? "mock"];
  if (!engine) {
    db.prepare("UPDATE tasks SET status = 'failed', error = ? WHERE id = ?").run(`No engine "${agent.engine}" configured`, next.id);
    return next.id;
  }
  if (!hasBudget(db, engine.name)) return null; // waits until tomorrow; nothing is bought
  const instructions = agentInstructions(agent.id);
  const version = versionOf(instructions);
  db.prepare("UPDATE tasks SET status = 'running', engine = ?, agent_version = ? WHERE id = ?").run(engine.name, version, next.id);
  const input = parseJson<Record<string, unknown>>(next.input, {});
  const result = await engine.run(buildPrompt(t, input, instructions), { taskType: t.id });
  countRun(db, engine.name);
  let output: unknown = result.text;
  let error = result.ok ? null : (result.error ?? "engine failed");
  if (result.ok && t.output === "json") {
    output = extractJson(result.text);
    if (output === null) error = "answer was not valid JSON";
  }
  if (!error && t.validate) error = t.validate(output);
  const status = error ? "failed" : t.needsApproval ? "awaiting_approval" : "done";
  db.prepare("UPDATE tasks SET status = ?, output = ?, error = ?, finished_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(
    status,
    typeof output === "string" ? output : JSON.stringify(output),
    error,
    next.id,
  );
  audit(db, agent.id, "task_finished", `task:${next.id}`, { status, version, engine: engine.name, ms: result.ms });
  return next.id;
}

/**
 * A person reviews an output. Approving = "I sign this". Rejecting needs a note.
 * `corrected` marks an approval after the reviewer changed the output; it counts toward the correction rate.
 */
export function review(db: Db, taskId: number, reviewer: string, decision: "approve" | "reject", opts: { note?: string; correctedOutput?: unknown } = {}) {
  const task = db.prepare("SELECT status FROM tasks WHERE id = ?").get(taskId) as { status: string } | undefined;
  if (task?.status !== "awaiting_approval") throw new Error("Only outputs awaiting approval can be reviewed.");
  const who = role(db, reviewer);
  if (!who || who.kind !== "human") throw new Error("Only a person can approve or reject.");
  if (decision === "reject" && !opts.note?.trim()) throw new Error("A rejection needs a note that says what was wrong.");
  const corrected = decision === "approve" && opts.correctedOutput !== undefined;
  db.prepare("UPDATE tasks SET status = ?, reviewed_by = ?, review_note = ?, corrected = ?, output = COALESCE(?, output) WHERE id = ?").run(
    decision === "approve" ? "approved" : "rejected",
    reviewer,
    opts.note ?? null,
    corrected || decision === "reject" ? 1 : 0,
    corrected ? JSON.stringify(opts.correctedOutput) : null,
    taskId,
  );
  audit(db, reviewer, `task_${decision}`, `task:${taskId}`, { note: opts.note, corrected });
}

/**
 * Share of reviewed outputs a person had to correct or reject. A healthy band is roughly 10–25 %:
 * below it, people probably stopped reviewing; above it, the agent needs recalibration, not more manual fixes.
 */
export function correctionRate(db: Db, agentId: string): { reviewed: number; corrected: number; rate: number; reading: string } {
  const r = db.prepare("SELECT count(*) reviewed, coalesce(sum(corrected),0) corrected FROM tasks WHERE agent_id = ? AND status IN ('approved','rejected')").get(agentId) as {
    reviewed: number;
    corrected: number;
  };
  const rate = r.reviewed ? r.corrected / r.reviewed : 0;
  const reading = r.reviewed < 10 ? "not enough reviews yet" : rate < 0.1 ? "suspiciously low: check that people are really reviewing" : rate > 0.25 ? "too high: recalibrate the agent" : "healthy";
  return { ...r, rate, reading };
}
