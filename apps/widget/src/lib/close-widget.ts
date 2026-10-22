// Pure-ish helper (one `window` read/write, no React) used by DrawerContent's
// close button. The drawer always runs inside public/embed.js's iframe (see
// ADR-0004's iframe embedding decision) — it has no direct reference to the
// host page's `window.Platform.close()`, so it asks across the frame
// boundary via postMessage instead, the same mechanism embed.js's "*"-origin
// CORS/frame-ancestors posture already assumes for an unknown host site.
// embed.js's own `message` listener (public/embed.js) is the other half.
export const CLOSE_MESSAGE = { source: "platform-widget", type: "close" } as const;

export function requestClose(): void {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage(CLOSE_MESSAGE, "*");
}
