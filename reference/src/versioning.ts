/**
 * VERSIONED OR IT DOESN'T EXIST.
 *
 * Every output records the exact version of the agent instructions and the
 * engine that produced it. Without that, two results from different months
 * cannot be compared, and a comparable history is the long-term asset.
 *
 * The version is a short hash of the instruction file, so any edit, even a
 * comma, produces a new version automatically.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const AGENTS_DIR = new URL("../agents/", import.meta.url).pathname;

export function agentInstructions(agentId: string, dir = AGENTS_DIR): string {
  return readFileSync(join(dir, `${agentId}.md`), "utf8");
}

export function versionOf(instructions: string): string {
  return createHash("sha256").update(instructions).digest("hex").slice(0, 12);
}
