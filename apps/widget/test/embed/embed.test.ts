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

// ---------------------------------------------------------------------------
// init() DOM wiring (issue #10: data-hide-default-button, data-platform-book,
// window.Platform.open/close). These need more than the pure-helper sandbox
// above — a minimal fake DOM capable of recording appendChild calls and
// firing click listeners — but deliberately stay a plain object literal
// rather than growing into a real fake-DOM implementation (jsdom etc.),
// matching the existing convention/comment on loadEmbedModule() above.

interface FakeElement {
  tagName: string;
  id: string;
  dataset: Record<string, string>;
  style: Record<string, string>;
  children: FakeElement[];
  // Only meaningful on an "iframe" element — a distinct object standing in
  // for its contentWindow, so the message-listener test below can assert
  // the event.source === iframeEl.contentWindow origin check (see
  // public/embed.js's message listener) against a real reference, not a
  // string/shape match.
  contentWindow: object;
  appendChild(child: FakeElement): void;
  addEventListener(type: string, fn: () => void): void;
  click(): void;
}

function createFakeElement(tagName: string): FakeElement {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    tagName,
    id: "",
    dataset: {},
    style: {},
    children: [],
    contentWindow: {},
    appendChild(child) {
      this.children.push(child);
    },
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    click() {
      (listeners.click || []).forEach((fn) => fn());
    },
  };
}

function createFakeDocument(options: { hideDefaultButton?: boolean; bookElements?: FakeElement[] } = {}) {
  const bodyChildren: FakeElement[] = [];
  const currentScript = {
    src: "",
    dataset: {
      tenant: "dentdi",
      ...(options.hideDefaultButton ? { hideDefaultButton: "" } : {}),
    },
  };
  const bookElements = options.bookElements ?? [];
  const doc = {
    currentScript,
    body: { appendChild: (el: FakeElement) => bodyChildren.push(el) },
    head: { appendChild: () => {} },
    createElement: (tag: string) => createFakeElement(tag),
    getElementById: () => undefined,
    querySelectorAll: (selector: string) => (selector === "[data-platform-book]" ? bookElements : []),
  };
  return { doc, bodyChildren };
}

// Fake `window` capable of recording `message` listeners and firing them —
// mirrors FakeElement's own addEventListener/click pairing above, sized for
// exactly the one event type (message) embed.js listens for on window.
function createFakeWindow(doc: unknown) {
  const messageListeners: Array<(event: { data: unknown; source: unknown }) => void> = [];
  const win: Record<string, unknown> = {
    document: doc,
    addEventListener(type: string, fn: (event: { data: unknown; source: unknown }) => void) {
      if (type === "message") messageListeners.push(fn);
    },
    dispatchMessage(data: unknown, source: unknown) {
      messageListeners.forEach((fn) => fn({ data, source }));
    },
  };
  return win;
}

function runEmbedModule(doc: unknown) {
  const source = fs.readFileSync(EMBED_JS_PATH, "utf-8");
  const win = createFakeWindow(doc) as { Platform?: unknown; dispatchMessage: (data: unknown, source: unknown) => void };
  const sandbox: Record<string, unknown> = { window: win, document: doc, console, URL };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "embed.js" });
  const platform = win.Platform as { open(): void; close(): void; isOpen(): boolean };
  // Merges dispatchMessage onto the returned Platform object so existing
  // call sites (platform.open()/.close()/.isOpen()) stay unchanged, while
  // the new message-listener test below can also drive platform.dispatchMessage(...).
  return Object.assign(platform, { dispatchMessage: win.dispatchMessage });
}

describe("init() DOM wiring (loaded via vm against the real file)", () => {
  it("creates the default floating trigger when data-hide-default-button is absent", () => {
    const { doc, bodyChildren } = createFakeDocument({});
    runEmbedModule(doc);
    expect(bodyChildren.some((el) => el.id === "platform-widget-trigger")).toBe(true);
  });

  it("suppresses the default trigger when data-hide-default-button is present", () => {
    const { doc, bodyChildren } = createFakeDocument({ hideDefaultButton: true });
    runEmbedModule(doc);
    expect(bodyChildren.some((el) => el.id === "platform-widget-trigger")).toBe(false);
  });

  it("opens the drawer when a [data-platform-book] element is clicked", () => {
    const bookEl = createFakeElement("button");
    const { doc } = createFakeDocument({ bookElements: [bookEl] });
    const platform = runEmbedModule(doc);

    expect(platform.isOpen()).toBe(false);
    bookEl.click();
    expect(platform.isOpen()).toBe(true);
  });

  it("wires multiple [data-platform-book] elements, each independently opening the drawer", () => {
    const bookA = createFakeElement("a");
    const bookB = createFakeElement("button");
    const { doc } = createFakeDocument({ bookElements: [bookA, bookB] });
    const platform = runEmbedModule(doc);

    bookA.click();
    expect(platform.isOpen()).toBe(true);
    platform.close();
    expect(platform.isOpen()).toBe(false);

    bookB.click();
    expect(platform.isOpen()).toBe(true);
  });

  it("closes when the iframe posts a platform-widget close message (the drawer's in-content close button, issue: no close affordance on mobile)", () => {
    const { doc, bodyChildren } = createFakeDocument({});
    const platform = runEmbedModule(doc);

    platform.open();
    expect(platform.isOpen()).toBe(true);

    const drawer = bodyChildren.find((el) => el.id === "platform-widget-drawer")!;
    const iframeEl = drawer.children.find((c) => c.tagName === "iframe")!;

    platform.dispatchMessage({ source: "platform-widget", type: "close" }, iframeEl.contentWindow);
    expect(platform.isOpen()).toBe(false);
  });

  it("ignores a close message whose source isn't the widget's own iframe", () => {
    const { doc } = createFakeDocument({});
    const platform = runEmbedModule(doc);

    platform.open();
    platform.dispatchMessage({ source: "platform-widget", type: "close" }, {});
    expect(platform.isOpen()).toBe(true);
  });

  it("ignores a same-source message that isn't the platform-widget close shape", () => {
    const { doc, bodyChildren } = createFakeDocument({});
    const platform = runEmbedModule(doc);

    platform.open();
    const drawer = bodyChildren.find((el) => el.id === "platform-widget-drawer")!;
    const iframeEl = drawer.children.find((c) => c.tagName === "iframe")!;

    platform.dispatchMessage({ foo: "bar" }, iframeEl.contentWindow);
    expect(platform.isOpen()).toBe(true);
  });

  it("exposes window.Platform.open()/close() globally, toggling isOpen()", () => {
    const { doc } = createFakeDocument({});
    const platform = runEmbedModule(doc);

    expect(platform.isOpen()).toBe(false);
    platform.open();
    expect(platform.isOpen()).toBe(true);
    platform.close();
    expect(platform.isOpen()).toBe(false);
  });

  it("drives the default trigger, a data-platform-book element, and window.Platform.open() through the same open() — one shared iframe, never re-created, across all three call paths", () => {
    const bookEl = createFakeElement("button");
    const { doc, bodyChildren } = createFakeDocument({ bookElements: [bookEl] });
    const platform = runEmbedModule(doc);

    const trigger = bodyChildren.find((el) => el.id === "platform-widget-trigger");
    trigger!.click();

    const drawer = bodyChildren.find((el) => el.id === "platform-widget-drawer");
    const iframesAfterTrigger = drawer!.children.filter((c) => c.tagName === "iframe");
    expect(iframesAfterTrigger).toHaveLength(1);
    const firstIframe = iframesAfterTrigger[0];

    bookEl.click();
    platform.open();

    const iframesAfterAll = drawer!.children.filter((c) => c.tagName === "iframe");
    expect(iframesAfterAll).toHaveLength(1);
    expect(iframesAfterAll[0]).toBe(firstIframe);
  });
});
