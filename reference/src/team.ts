/**
 * ROLES AS CODE.
 *
 * Every seat in the firm, human or AI, is a role with a name, a supervisor,
 * a written list of what it does and what it never does, and a status.
 * The file is versioned; a sync puts it in the database without overwriting
 * what people change in the app (who was hired, which agent was paused).
 *
 * Three rules this structure enforces by design:
 *   1. An agent has a human-sounding name so the team can talk about it
 *      naturally, but it is labeled as an AI agent everywhere and never
 *      presents itself as a person.
 *   2. No agent decides, signs or sends anything to a client. It produces
 *      candidates; a person approves them.
 *   3. Empty seats exist as "vacant" roles, so work has an owner from day one
 *      and the person who joins inherits the queue.
 *
 * The sample below is a fictional firm, Northwind Advisory.
 */
import { audit, type Db } from "./db.ts";

export type RoleKind = "human" | "agent";
export type RoleStatus = "active" | "vacant" | "building" | "paused";
export type EngineName = "mock" | "rule" | "cli";
/** How much judgment the seat needs. Each engine maps this to a model tier. */
export type Level = "judgment" | "analysis" | "mechanical";

export type Role = {
  id: string;
  kind: RoleKind;
  name: string;
  title: string;
  unit: "leadership" | "commercial" | "delivery" | "governance" | "operations";
  supervisor?: string;
  status: RoleStatus;
  engine?: EngineName;
  level?: Level;
  summary: string;
  does: string[];
  doesNot: string[];
};

export const TEAM: Role[] = [
  {
    id: "founder",
    kind: "human",
    name: "Alex Rivera",
    title: "Founder & CEO",
    unit: "leadership",
    status: "active",
    summary: "Decides which clients come in, signs every deliverable and approves what the agents propose.",
    does: ["Accept or decline clients, with a written reason", "Assign final scores and sign deliverables", "Approve or reject every agent output"],
    doesNot: ["Review the quality of their own deliverables: someone else does, with veto power"],
  },
  {
    id: "quality-reviewer",
    kind: "human",
    name: "Independent quality reviewer",
    title: "Blind review with veto",
    unit: "leadership",
    supervisor: "founder",
    status: "vacant",
    summary: "Reviews every deliverable without having sold it. Can veto; only the founder can lift a veto, in writing.",
    does: ["Check every high score against its evidence", "Veto what the evidence does not support"],
    doesNot: ["Take part in selling the project they review"],
  },
  {
    id: "account-manager",
    kind: "human",
    name: "Jordan Lee",
    title: "Account Manager",
    unit: "commercial",
    supervisor: "founder",
    status: "active",
    summary: "Owns the relationship from first contact to signature and qualifies before handing over to the founder.",
    does: ["Answer every application within 24 hours", "Qualify pain, budget and decision, in that order"],
    doesNot: ["Quote prices", "Send anything that did not pass the compliance check"],
  },
  {
    id: "chief-of-staff",
    kind: "agent",
    name: "Iris",
    title: "Chief of staff (AI agent)",
    unit: "leadership",
    supervisor: "founder",
    status: "active",
    engine: "mock",
    level: "judgment",
    summary: "Prepares the founder's decisions, chases commitments and coordinates the other agents.",
    does: ["Daily brief", "Decision memos with the risk of doing and of not doing"],
    doesNot: ["Decide", "Send anything to third parties", "Change its own rules"],
  },
  {
    id: "intake-reviewer",
    kind: "agent",
    name: "Nora",
    title: "Intake reviewer (AI agent)",
    unit: "commercial",
    supervisor: "chief-of-staff",
    status: "active",
    engine: "mock",
    level: "judgment",
    summary: "Reads every application and proposes a qualification score, quoting the sentence that supports each point.",
    does: ["Candidate score with the supporting sentence", "Detect automatic disqualifiers"],
    doesNot: ["Decide whether the prospect gets in", "Promise figures or dates"],
  },
  {
    id: "compliance-checker",
    kind: "agent",
    name: "Iza",
    title: "Compliance checker (AI agent)",
    unit: "governance",
    supervisor: "chief-of-staff",
    status: "active",
    engine: "mock",
    level: "analysis",
    summary: "No outbound message leaves without passing the rules in code and then this review.",
    does: ["Check legal basis, opt-out, unsourced figures and honesty about AI"],
    doesNot: ["Approve by silence"],
  },
  {
    id: "follow-up-writer",
    kind: "agent",
    name: "Theo",
    title: "Follow-up writer (AI agent)",
    unit: "commercial",
    supervisor: "chief-of-staff",
    status: "active",
    engine: "mock",
    level: "analysis",
    summary: "Drafts follow-ups so no conversation goes cold.",
    does: ["Draft follow-ups by stage and objection"],
    doesNot: ["Send", "Insist after a no"],
  },
  {
    id: "evidence-checker",
    kind: "agent",
    name: "Lena",
    title: "Evidence checker (AI agent)",
    unit: "delivery",
    supervisor: "chief-of-staff",
    status: "building",
    engine: "mock",
    level: "judgment",
    summary: "Confirms or rejects every high score. Without a document or a system query, the score drops.",
    does: ["CONFIRM or REJECT, with a one-line reason"],
    doesNot: ["Accept an interview statement as evidence for a high score"],
  },
];

/**
 * Sync the file into the database. People edit status in the app (hiring, pausing an agent);
 * the file sets it only the first time, so a deploy never undoes a decision made in the app.
 */
export function syncTeam(db: Db, team: Role[] = TEAM) {
  const upsert = db.prepare(`
    INSERT INTO roles (id, kind, name, title, unit, supervisor_id, status, engine, level, summary, does, does_not)
    VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind, name = excluded.name, title = excluded.title, unit = excluded.unit,
      engine = excluded.engine, level = excluded.level, summary = excluded.summary,
      does = excluded.does, does_not = excluded.does_not,
      status = CASE WHEN roles.status_set_in_app = 1 THEN roles.status ELSE excluded.status END`);
  // First without supervisors so every reference exists, then with them.
  for (const r of team) upsert.run(r.id, r.kind, r.name, r.title, r.unit, r.status, r.engine ?? null, r.level ?? null, r.summary, JSON.stringify(r.does), JSON.stringify(r.doesNot));
  const boss = db.prepare("UPDATE roles SET supervisor_id = ? WHERE id = ?");
  for (const r of team) boss.run(r.supervisor ?? null, r.id);
}

/** A status change made by a person in the app wins over the file from then on. */
export function setRoleStatus(db: Db, roleId: string, status: RoleStatus, by: string) {
  db.prepare("UPDATE roles SET status = ?, status_set_in_app = 1 WHERE id = ?").run(status, roleId);
  audit(db, by, "role_status", roleId, { status });
}

export function role(db: Db, id: string) {
  return db.prepare("SELECT * FROM roles WHERE id = ?").get(id) as
    | { id: string; kind: RoleKind; name: string; status: RoleStatus; engine: EngineName | null; level: Level | null }
    | undefined;
}
