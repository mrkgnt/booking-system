import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The widget's own origin the e2e-run embed.js is served from. Defaults to
// playwright.config.ts's baseURL (http://localhost:8082 locally) but stays
// overridable (E2E_WIDGET_ORIGIN) for CI/other environments later.
export const WIDGET_ORIGIN = process.env.E2E_WIDGET_ORIGIN ?? "http://localhost:8082";

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

// Maps served path -> fixture file. Both fixtures share the same
// __WIDGET_ORIGIN__ substitution; they differ only in the data-tenant slug
// embed.js reads off its <script> tag (host.html: the real, inactive
// "dentdi"; host-unknown-tenant.html: a slug apps/api's tenant registry
// has never heard of) — see e2e/unavailable.spec.ts (issue #11).
const FIXTURES: Record<string, string> = {
  "/host.html": path.join(FIXTURES_DIR, "host.html"),
  "/host-unknown-tenant.html": path.join(FIXTURES_DIR, "host-unknown-tenant.html"),
};

// Serves the fixtures above over real http://, NOT file://. This matters,
// not just for convenience: the drawer route's CSP
// (`Content-Security-Policy: frame-ancestors *`) only matches
// network-scheme ancestors (http/https/ws/wss) per the CSP spec — a
// file:// parent is explicitly excluded, so Chromium actually blocks the
// iframe from framing the drawer at all when the host page is loaded via
// file://. A tiny local static server is the simplest way to exercise the
// real embed.js against a page whose scheme matches how an actual Tenant
// site (always http/https) would load it.
let server: http.Server | null = null;
let serverPort: number | null = null;

function startServer(): Promise<number> {
  if (server && serverPort !== null) return Promise.resolve(serverPort);
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      const fixturePath = req.url ? FIXTURES[req.url] : undefined;
      if (fixturePath) {
        const html = fs.readFileSync(fixturePath, "utf-8").replaceAll("__WIDGET_ORIGIN__", WIDGET_ORIGIN);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server!.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to determine host-fixture server port"));
        return;
      }
      serverPort = address.port;
      resolve(serverPort);
    });
  });
}

export async function hostFixtureUrl(): Promise<string> {
  const port = await startServer();
  return `http://127.0.0.1:${port}/host.html`;
}

// Same fixture server, serving the unknown-tenant variant — see
// e2e/unavailable.spec.ts (issue #11).
export async function hostUnknownTenantFixtureUrl(): Promise<string> {
  const port = await startServer();
  return `http://127.0.0.1:${port}/host-unknown-tenant.html`;
}

export function closeHostFixtureServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => resolve());
    server = null;
    serverPort = null;
  });
}

// --- Issue #11: simulating a live apps/api outage ---------------------
//
// fetchTenantInfo (src/lib/api/tenant-info.ts) runs server-side, inside
// apps/widget's own Astro SSR render — a browser-level Playwright
// page.route() intercept can't reach it, since the fetch never touches the
// browser's network stack at all. The only faithful way to simulate "the
// drawer's own live content fetch fails" is a second apps/widget dev
// server instance, started with its API_BASE_URL pointed at a port nothing
// listens on, so every fetchTenantInfo call fails fast with a real
// connection-refused error (not a slow timeout).
//
// Deliberately NOT the same port apps/widget normally dev-runs on (8082,
// astro.config.mjs) or the one or two nearby ports other local tooling in
// this repo already claims (apps/api's 8081/8787, apps/admin's 8080) —
// picked a port far enough away that a stray leftover process from a
// previous run is unlikely to collide with it.
const UNREACHABLE_API_PORT = 9; // "discard" service port; nothing listens here locally.
const UNREACHABLE_WIDGET_PORT = 8391;

let unreachableApiProcess: ChildProcess | null = null;
let unreachableApiOrigin: string | null = null;

function waitUntilReachable(origin: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      fetch(`${origin}/embed.js`).then(
        () => resolve(),
        () => {
          if (Date.now() > deadline) {
            reject(new Error(`Timed out waiting for widget server at ${origin} to come up`));
            return;
          }
          setTimeout(attempt, 200);
        },
      );
    };
    attempt();
  });
}

// Starts (once, memoized) a second `astro dev` instance of THIS SAME
// worktree's apps/widget, with API_BASE_URL overridden to an unreachable
// address, and returns its origin once it's actually accepting requests.
export async function startWidgetServerWithUnreachableApi(): Promise<string> {
  if (unreachableApiProcess && unreachableApiOrigin) return unreachableApiOrigin;

  const widgetRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const origin = `http://localhost:${UNREACHABLE_WIDGET_PORT}`;

  unreachableApiProcess = spawn(
    "pnpm",
    ["exec", "astro", "dev", "--port", String(UNREACHABLE_WIDGET_PORT)],
    {
      cwd: widgetRoot,
      env: { ...process.env, API_BASE_URL: `http://127.0.0.1:${UNREACHABLE_API_PORT}` },
      stdio: "pipe",
    },
  );
  unreachableApiProcess.on("error", (err) => {
    console.error("[e2e] failed to spawn the unreachable-API widget server:", err);
  });

  await waitUntilReachable(origin, 20_000);
  unreachableApiOrigin = origin;
  return origin;
}

export function stopWidgetServerWithUnreachableApi(): Promise<void> {
  return new Promise((resolve) => {
    if (!unreachableApiProcess) {
      resolve();
      return;
    }
    const proc = unreachableApiProcess;
    unreachableApiProcess = null;
    unreachableApiOrigin = null;
    proc.once("exit", () => resolve());
    proc.kill();
  });
}
