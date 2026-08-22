import { createServerClient, parseCookieHeader, type CookieOptionsWithName, type CookieOptions } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import type { Database } from "../../../../api/src/lib/database.types.js";

// httpOnly throughout — browser JS never reads the session cookie directly;
// pages that need the raw access token read it server-side (see
// lib/auth/session.ts) and hand it to islands as a prop instead.
const cookieOptions: CookieOptionsWithName = {
  httpOnly: true,
  sameSite: "lax",
  secure: import.meta.env.PROD,
  path: "/",
};

export function createSupabaseServerClient(request: Request, cookies: AstroCookies) {
  return createServerClient<Database>(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_ANON_KEY,
    {
      cookieOptions,
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("Cookie") ?? "");
        },
        // Astro writes the Set-Cookie header via cookies.set — also how a
        // refreshed access token (auto-refresh triggered by getUser/
        // getSession) gets persisted without any extra wiring.
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookies.set(name, value, options);
          });
        },
      },
    },
  );
}
