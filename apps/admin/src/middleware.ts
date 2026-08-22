import { defineMiddleware } from "astro/middleware";
import { getStaffSession } from "./lib/auth/session.js";
import { isPublicPath } from "./lib/auth/route-guard.js";

export const onRequest = defineMiddleware(async (context, next) => {
  if (isPublicPath(context.url.pathname)) {
    return next();
  }
  const session = await getStaffSession(context.request, context.cookies);
  if (!session) {
    return context.redirect("/login");
  }
  context.locals.session = session;
  return next();
});
