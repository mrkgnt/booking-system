import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Spawns a SECOND, disposable `astro dev` instance of apps/widget itself —
// not a mock of apps/widget, only of the one apps/api response it calls
// (see tenant-info-stub-server.ts for why) — with API_BASE_URL overridden
// to point at that stub instead of the real apps/api. This is additive:
// it doesn't touch or depend on whatever "normal" apps/widget dev server
// (port 8082, pointed at the real apps/api) is already running for the
// rest of apps/widget/e2e; this spec manages its own pair of processes
// end to end so it's fully self-contained and hermetic.
//
// `--port` is a CLI flag (always wins over astro.config.mjs's fixed 8082),
// and `API_BASE_URL` set in the child's own env is NOT overridden by
// apps/widget/.env — Vite's env loading only fills in keys absent from
// process.env, never replaces ones already set (verified directly against
// this exact repo's astro/vite versions before relying on it here).
const WIDGET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

let child: ChildProcess | null = null;

async function waitForReady(port: number, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // "localhost", not "127.0.0.1" — astro dev's default bind only
      // answers on the former on this machine (confirmed empirically:
      // 127.0.0.1 connection-refused, localhost 200, same astro version).
      const res = await fetch(`http://localhost:${port}/drawer?tenant=readiness-probe`);
      if (res.status) return; // any response at all means the server is up
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`apps/widget dev instance on port ${port} did not become ready within ${timeoutMs}ms`);
}

export async function startWidgetDevInstance(port: number, apiBaseUrl: string): Promise<void> {
  child = spawn("pnpm", ["exec", "astro", "dev", "--port", String(port)], {
    cwd: WIDGET_DIR,
    env: { ...process.env, API_BASE_URL: apiBaseUrl },
    stdio: "pipe",
  });
  await waitForReady(port);
}

export function stopWidgetDevInstance(): Promise<void> {
  return new Promise((resolve) => {
    if (!child) {
      resolve();
      return;
    }
    const proc = child;
    child = null;
    proc.once("exit", () => resolve());
    proc.kill("SIGTERM");
    // Fallback in case SIGTERM doesn't land in time (Vite's dev server has
    // been known to occasionally need a harder nudge on teardown).
    setTimeout(() => {
      if (!proc.killed) proc.kill("SIGKILL");
      resolve();
    }, 5_000);
  });
}
