import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// embed.js (apps/widget/public/embed.js) is deliberately a hand-written,
// import-free classic script — it has to run unmodified on an arbitrary
// third-party host page with no bundler/framework available (see ADR-0004 /
// issue #6). That means it can't `export` its pure helpers for a normal
// vitest import. Instead we load the REAL file (not a duplicated copy) into
// a minimal vm sandbox and exercise the pure, non-DOM functions it exposes
// on `window.Platform.__internal` — this is the "anything non-DOM" seam
// issue #9 calls out, applied directly to the production artifact rather
// than a parallel module that could drift from it.
const EMBED_JS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/embed.js");

function loadEmbedModule() {
  const source = fs.readFileSync(EMBED_JS_PATH, "utf-8");
  const sandbox: Record<string, unknown> = {
    window: {},
    // No currentScript / real DOM in this sandbox — just enough for the
    // IIFE's top-level `init()` call to bail out early (no data-tenant
    // found) without touching document.body/createElement, so this stub
    // never needs to grow into a fake DOM implementation.
    document: { currentScript: null, addEventListener: () => {}, querySelectorAll: () => [] },
    console,
    URL,
  };
  (sandbox.window as Record<string, unknown>).document = sandbox.document;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "embed.js" });
  return (sandbox.window as { Platform?: { __internal?: Record<string, (...a: unknown[]) => unknown> } }).Platform;
}

describe("embed.js pure helpers (loaded via vm against the real file)", () => {
  const platform = loadEmbedModule();

  it("exposes internal helpers for testing without a real DOM", () => {
    expect(platform?.__internal).toBeDefined();
  });

  describe("buildDrawerSrc", () => {
    it("builds a /drawer?tenant=<slug> URL against the widget's own origin", () => {
      const src = platform!.__internal!.buildDrawerSrc("https://widget.example.com", "dentdi");
      expect(src).toBe("https://widget.example.com/drawer?tenant=dentdi");
    });

    it("appends &locale=<locale> when a locale is given", () => {
      const src = platform!.__internal!.buildDrawerSrc("https://widget.example.com", "dentdi", "ru");
      expect(src).toBe("https://widget.example.com/drawer?tenant=dentdi&locale=ru");
    });
  });

  describe("readConfig", () => {
    it("reads data-tenant/data-locale/data-hide-default-button off a script-like dataset", () => {
      const config = platform!.__internal!.readConfig({
        dataset: { tenant: "dentdi", locale: "lv", hideDefaultButton: "" },
      });
      expect(config).toEqual({ tenant: "dentdi", locale: "lv", hideDefaultButton: true });
    });

    it("returns tenant: null and hideDefaultButton: false when attributes are absent", () => {
      const config = platform!.__internal!.readConfig({ dataset: {} });
      expect(config).toEqual({ tenant: null, locale: null, hideDefaultButton: false });
    });

    it("tolerates a missing/null script element entirely", () => {
      const config = platform!.__internal!.readConfig(null);
      expect(config).toEqual({ tenant: null, locale: null, hideDefaultButton: false });
    });
  });
});
