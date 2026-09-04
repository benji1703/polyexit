import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type Viewer = {
  id: string;
  email: string;
  displayName: string;
  role: "member" | "moderator" | "admin";
  balance: number;
};

export const getCurrentViewer = cache(async (): Promise<Viewer | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) return null;

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id,email,display_name,role,status,balance")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile || profile.status !== "active" || profile.email !== data.user.email.toLowerCase()) {
      return null;
    }

    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      role: profile.role,
      balance: profile.balance,
    } as Viewer;
  } catch {
    return null;
  }
});

export async function requireViewer() {
  const viewer = await getCurrentViewer();
  if (!viewer) redirect("/sign-in");
  return viewer;
}

export async function requireAdmin() {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") redirect("/");
  return viewer;
}

