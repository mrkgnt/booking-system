import { defineMiddleware } from "astro/middleware";

// Applied narrowly to the /drawer route — the one route meant to be
// embedded in an <iframe> on an arbitrary third-party host page. Everything
// else in apps/widget (e.g. the embed.js static asset itself) gets no CSP
// header at all; only the route actually being framed needs
// frame-ancestors relaxed, per ADR-0004's "the embedding origin is unknown
// in advance" rationale.
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (context.url.pathname === "/drawer") {
    response.headers.set("Content-Security-Policy", "frame-ancestors *");
  }
  return response;
});
