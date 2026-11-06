/**
 * THE WORKER: one task at a time.
 *
 * A loop that wakes up, re-checks blocked tasks, runs the oldest queued task
 * and sleeps. One at a time on purpose: it keeps usage ordinary, makes the
 * audit log easy to read and avoids two agents racing on the same record.
 *
 * Agents also act on their own when something real happens (a new
 * application arrives, a reply is 18 hours old). Those triggers create tasks;
 * the worker runs them like any other.
 */
import type { Db } from "./db.ts";
import type { Engine } from "./engines.ts";
import { runNext, unblock } from "./tasks.ts";

export async function tick(db: Db, engines: Partial<Record<string, Engine>>): Promise<number | null> {
  unblock(db);
  return runNext(db, engines);
}

export async function runWorker(db: Db, engines: Partial<Record<string, Engine>>, opts: { intervalMs?: number; signal?: AbortSignal } = {}) {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  while (!opts.signal?.aborted) {
    const ran = await tick(db, engines);
    if (ran === null) await wait(opts.intervalMs ?? 15_000);
  }
}
