"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppUrl } from "@/lib/config";
import { normalizeEmail, rateLimitKey } from "@/lib/security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = { status: "idle" | "sent" | "error"; message: string };

const signInSchema = z.object({ email: z.email().max(254) });

async function isInvited(email: string) {
  const admins = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
  if (admins.has(email)) return true;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("invitations")
    .select("email")
    .eq("email", email)
    .in("status", ["pending", "accepted"])
    .maybeSingle();
  return Boolean(data);
}

export async function requestMagicLink(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email") });
  const genericSuccess: SignInState = {
    status: "sent",
    message: "If this address is invited, a secure sign-in link is on its way.",
  };

  if (!parsed.success) {
    return { status: "error", message: "Enter a valid work email address." };
  }

  try {
    const email = normalizeEmail(parsed.data.email);
    const admin = createSupabaseAdminClient();
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    const limiterIdentity = `${email}:${forwardedFor || "unknown"}`;
    const { data: allowed } = await admin.rpc("consume_rate_limit", {
      p_key: rateLimitKey("magic-link", limiterIdentity),
      p_limit: 5,
      p_window_seconds: 900,
    });
    if (!allowed) return genericSuccess;
    if (!(await isInvited(email))) return genericSuccess;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${getAppUrl()}/auth/callback?next=/`,
      },
    });
    if (error) throw error;
    return genericSuccess;
  } catch {
    return {
      status: "error",
      message: "Sign-in is temporarily unavailable. Please try again shortly.",
    };
  }
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

