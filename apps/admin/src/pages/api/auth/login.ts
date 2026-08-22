import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabase/server.js";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = form.get("email")?.toString();
  const password = form.get("password")?.toString();
  if (!email || !password) {
    return redirect("/login?error=" + encodeURIComponent("Email and password are required"));
  }
  const supabase = createSupabaseServerClient(request, cookies);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return redirect("/login?error=" + encodeURIComponent(error.message));
  }
  return redirect("/bookings");
};
