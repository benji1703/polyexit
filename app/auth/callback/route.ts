import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/config";
import { isAdminEmail, normalizeEmail, safeRelativePath } from "@/lib/security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeRelativePath(url.searchParams.get("next"));
  const failure = new URL("/sign-in?error=invalid-link", getAppUrl());

  if (!code) return NextResponse.redirect(failure);

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user?.email) throw new Error("Missing verified email");

    const email = normalizeEmail(user.email);
    const admin = createSupabaseAdminClient();
    const adminUser = isAdminEmail(email);
    const { data: invitation } = await admin
      .from("invitations")
      .select("email,role,status")
      .eq("email", email)
      .in("status", ["pending", "accepted"])
      .maybeSingle();

    if (!adminUser && !invitation) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/sign-in?error=not-invited", getAppUrl()));
    }

    const displayName = String(user.user_metadata?.full_name || email.split("@")[0]).slice(0, 60);
    const role = adminUser ? "admin" : invitation?.role || "member";
    const { error: activationError } = await admin.rpc("activate_profile", {
      p_user_id: user.id,
      p_email: email,
      p_display_name: displayName,
      p_role: role,
    });
    if (activationError) throw activationError;

    return NextResponse.redirect(new URL(next, getAppUrl()));
  } catch {
    return NextResponse.redirect(failure);
  }
}
