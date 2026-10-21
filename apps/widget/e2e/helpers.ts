import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The widget's own origin the e2e-run embed.js is served from. Defaults to
// playwright.config.ts's baseURL (http://localhost:8082 locally) but stays
// overridable (E2E_WIDGET_ORIGIN) for CI/other environments later.
export const WIDGET_ORIGIN = process.env.E2E_WIDGET_ORIGIN ?? "http://localhost:8082";

const FIXTURE_SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/host.html");

// Serves e2e/fixtures/host.html (with __WIDGET_ORIGIN__ substituted) over
// real http://, NOT file://. This matters, not just for convenience: the
// drawer route's CSP (`Content-Security-Policy: frame-ancestors *`) only
// matches network-scheme ancestors (http/https/ws/wss) per the CSP spec —
// a file:// parent is explicitly excluded, so Chromium actually blocks the
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
      if (req.url === "/host.html") {
        const html = fs.readFileSync(FIXTURE_SRC, "utf-8").replaceAll("__WIDGET_ORIGIN__", WIDGET_ORIGIN);
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
