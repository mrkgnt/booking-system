import { afterEach, describe, expect, it, vi } from "vitest";
import { CLOSE_MESSAGE, requestClose } from "../../src/lib/close-widget.js";

describe("requestClose", () => {
  afterEach(() => {
    // @ts-expect-error — test-only global cleanup
    delete globalThis.window;
  });

  it("posts the platform-widget close message to window.parent", () => {
    const postMessage = vi.fn();
    const parent = { postMessage };
    // @ts-expect-error — minimal fake window, only what requestClose reads
    globalThis.window = { parent };

    requestClose();

    expect(postMessage).toHaveBeenCalledWith(CLOSE_MESSAGE, "*");
  });

  it("does nothing when window.parent === window (not embedded in an iframe)", () => {
    const postMessage = vi.fn();
    const win: Record<string, unknown> = { parent: undefined, postMessage };
    win.parent = win;
    // @ts-expect-error — minimal fake window
    globalThis.window = win;

    requestClose();

    expect(postMessage).not.toHaveBeenCalled();
  });

  it("does nothing when window is undefined (SSR)", () => {
    // @ts-expect-error — simulating no window global
    delete globalThis.window;
    expect(() => requestClose()).not.toThrow();
  });
});
