import type { AstroCookies } from "astro";
import { createSupabaseServerClient } from "../supabase/server.js";

export type StaffSession = { accessToken: string; user: { id: string; email: string } };

// getUser() validates the JWT against Supabase (and auto-refreshes an
// expired one, persisted via server.ts's setAll) — the trust boundary.
// getSession() then just reads the resulting access_token back out.
export async function getStaffSession(request: Request, cookies: AstroCookies): Promise<StaffSession | null> {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;
  return {
    accessToken: sessionData.session.access_token,
    user: { id: userData.user.id, email: userData.user.email ?? "" },
  };
}
