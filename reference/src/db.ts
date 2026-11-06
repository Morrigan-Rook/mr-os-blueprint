/**
 * Storage. One SQLite file is enough for a firm of a few dozen roles: it is
 * fast, it backs up with a file copy, and it keeps the whole operation in one
 * place you control. MR OS runs on SQLite in production.
 *
 * Uses Node's built-in `node:sqlite` so the reference has zero dependencies.
 */
import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('human','agent')),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  unit TEXT NOT NULL,
  supervisor_id TEXT REFERENCES roles(id),
  status TEXT NOT NULL CHECK (status IN ('active','vacant','building','paused')),
  engine TEXT,
  level TEXT,
  summary TEXT NOT NULL,
  does TEXT NOT NULL,
  does_not TEXT NOT NULL,
  status_set_in_app INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  -- Account opening checklist: every item must be true before any agent may touch client data.
  opening TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  kind TEXT NOT NULL CHECK (kind IN ('document','system','interview')),
  pointer TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  area TEXT NOT NULL,
  dimension TEXT NOT NULL,
  value INTEGER CHECK (value BETWEEN 0 AND 4),
  not_measurable INTEGER NOT NULL DEFAULT 0,
  evidence_ids TEXT NOT NULL DEFAULT '[]',
  decided_by TEXT NOT NULL REFERENCES roles(id),
  UNIQUE (account_id, area, dimension)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES roles(id),
  input TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('blocked','queued','running','awaiting_approval','approved','rejected','failed','done')),
  blocked_reason TEXT,
  output TEXT,
  error TEXT,
  engine TEXT,
  agent_version TEXT,
  requested_by TEXT NOT NULL,
  reviewed_by TEXT,
  review_note TEXT,
  corrected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS engine_runs (
  day TEXT NOT NULL,
  engine TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, engine)
);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT,
  data TEXT
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export function openDb(path = ":memory:"): Db {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}

export function setting(db: Db, key: string, fallback: string): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(db: Db, key: string, value: string) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

/** Every decision leaves a trace. The audit log is append-only by convention. */
export function audit(db: Db, actor: string, action: string, entity?: string, data?: unknown) {
  db.prepare("INSERT INTO audit (actor, action, entity, data) VALUES (?, ?, ?, ?)").run(actor, action, entity ?? null, data === undefined ? null : JSON.stringify(data));
}

export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
