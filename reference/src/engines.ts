/**
 * ENGINES: pluggable, capped and isolated.
 *
 * An engine turns a prompt into text. The reference ships three:
 *   - mock: deterministic answers, for demos and tests.
 *   - rule: plain code, no language model (counters, alerts, gates).
 *   - cli:  any command-line tool that reads a prompt on stdin and writes the
 *           answer on stdout (for example an official vendor CLI).
 *
 * Three protections apply to every engine:
 *   1. Allowlisted environment. The child process gets only the variables it
 *      needs. Paid API keys and the server's own secrets never reach it, even
 *      if someone leaves them on the server by mistake.
 *   2. Daily cap per engine, stored in the database. When the cap is reached,
 *      work waits until tomorrow; nobody buys extra capacity by accident.
 *   3. One run at a time (the worker enforces it).
 *
 * MR OS runs its agents on the official CLIs of the AI vendors under the
 * firm's subscriptions, not on pay-per-use APIs. If you do the same, read
 * each vendor's current terms: what a subscription allows changes over time
 * and differs between vendors. Choose the mode your use actually fits.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Db, setting } from "./db.ts";
import type { EngineName } from "./team.ts";

export type RunResult = { ok: boolean; text: string; error?: string; ms: number };
export type Engine = { name: EngineName; run: (prompt: string, ctx: { taskType: string }) => Promise<RunResult> };

/** Variables an engine may see. Everything else, including any *_API_KEY, is dropped. */
export const ENV_ALLOWLIST = ["PATH", "HOME", "LANG", "LC_ALL", "TZ", "TMPDIR", "USER"];

export function safeEnv(source: NodeJS.ProcessEnv = process.env, extra: string[] = []): NodeJS.ProcessEnv {
  const env: Record<string, string> = {};
  for (const k of [...ENV_ALLOWLIST, ...extra]) {
    if (/_API_KEY$|SECRET|PASSWORD/i.test(k)) continue; // never, even if someone adds it to `extra`
    if (source[k]) env[k] = source[k]!;
  }
  return env as NodeJS.ProcessEnv;
}

export function mockEngine(answers: Record<string, string | ((prompt: string) => string)>): Engine {
  return {
    name: "mock",
    async run(prompt, { taskType }) {
      const a = answers[taskType];
      if (a === undefined) return { ok: false, text: "", error: `mock has no answer for ${taskType}`, ms: 0 };
      return { ok: true, text: typeof a === "function" ? a(prompt) : a, ms: 1 };
    },
  };
}

/**
 * Runs `command` with the prompt on stdin, in an empty temporary folder, with an allowlisted
 * environment and a timeout. Example command: ["your-vendor-cli", "--print"].
 */
export function cliEngine(command: string[], opts: { timeoutMs?: number; extraEnv?: string[] } = {}): Engine {
  return {
    name: "cli",
    run(prompt) {
      return new Promise((resolve) => {
        const started = Date.now();
        const cwd = mkdtempSync(join(tmpdir(), "agent-"));
        const child = spawn(command[0]!, command.slice(1), { cwd, env: safeEnv(process.env, opts.extraEnv), stdio: ["pipe", "pipe", "pipe"] });
        let out = "";
        let err = "";
        const timer = setTimeout(() => child.kill("SIGTERM"), opts.timeoutMs ?? 300_000);
        child.stdout.on("data", (b) => (out += b));
        child.stderr.on("data", (b) => (err += b));
        child.on("error", (e) => {
          clearTimeout(timer);
          rmSync(cwd, { recursive: true, force: true });
          resolve({ ok: false, text: "", error: e.message, ms: Date.now() - started });
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          rmSync(cwd, { recursive: true, force: true });
          resolve(code === 0 ? { ok: true, text: out.trim(), ms: Date.now() - started } : { ok: false, text: out, error: err.slice(0, 500) || `exit ${code}`, ms: Date.now() - started });
        });
        child.stdin.end(prompt);
      });
    },
  };
}

const today = () => new Date().toISOString().slice(0, 10);

/** True if the engine still has runs left today. The cap lives in settings, e.g. cap.cli = 40. */
export function hasBudget(db: Db, engine: EngineName): boolean {
  const cap = Number(setting(db, `cap.${engine}`, engine === "mock" || engine === "rule" ? "100000" : "40"));
  const row = db.prepare("SELECT count FROM engine_runs WHERE day = ? AND engine = ?").get(today(), engine) as { count: number } | undefined;
  return (row?.count ?? 0) < cap;
}

export function countRun(db: Db, engine: EngineName) {
  db.prepare("INSERT INTO engine_runs (day, engine, count) VALUES (?, ?, 1) ON CONFLICT(day, engine) DO UPDATE SET count = count + 1").run(today(), engine);
}
