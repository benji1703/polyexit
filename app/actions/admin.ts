"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/security";

const inviteSchema = z.object({ email: z.email().max(254), role: z.enum(["member", "moderator"]) });
const marketSchema = z.object({
  title: z.string().trim().min(10).max(140), description: z.string().trim().min(20).max(600),
  category: z.enum(["people", "company", "secondary"]), closesAt: z.iso.datetime(),
  resolutionSource: z.string().trim().min(10).max(300), initialProbability: z.coerce.number().int().min(5).max(95),
  featured: z.boolean(), optInConfirmed: z.boolean(),
});

function slugify(title: string) {
  return `${title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72)}-${Date.now().toString(36)}`;
}

export async function inviteMember(formData: FormData) {
  const viewer = await requireAdmin();
  const parsed = inviteSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) redirect("/admin?error=invalid-invite");
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("invitations").upsert({
    email: normalizeEmail(parsed.data.email), role: parsed.data.role, status: "pending", invited_by: viewer.id,
  }, { onConflict: "email" });
  if (error) redirect("/admin?error=invite-failed");
  await admin.from("audit_log").insert({ actor_id: viewer.id, action: "invitation.upserted", target_type: "email", metadata: { role: parsed.data.role } });
  revalidatePath("/admin");
  redirect("/admin?success=invited");
}

export async function createMarket(formData: FormData) {
  const viewer = await requireAdmin();
  const closesAtInput = String(formData.get("closesAt") ?? "");
  const closesAtDate = new Date(closesAtInput);
  const closesAt = Number.isNaN(closesAtDate.getTime()) ? "" : closesAtDate.toISOString();
  const parsed = marketSchema.safeParse({
    title: formData.get("title"), description: formData.get("description"), category: formData.get("category"),
    closesAt,
    resolutionSource: formData.get("resolutionSource"), initialProbability: formData.get("initialProbability"),
    featured: formData.get("featured") === "on", optInConfirmed: formData.get("optInConfirmed") === "on",
  });
  if (!parsed.success) redirect("/admin?error=invalid-market");
  if (new Date(parsed.data.closesAt).getTime() <= Date.now()) redirect("/admin?error=invalid-market");
  if (parsed.data.category === "people" && !parsed.data.optInConfirmed) redirect("/admin?error=opt-in-required");
  const admin = createSupabaseAdminClient();
  if (parsed.data.featured) await admin.from("markets").update({ featured: false }).eq("featured", true);
  const { data, error } = await admin.from("markets").insert({
    slug: slugify(parsed.data.title), title: parsed.data.title, description: parsed.data.description,
    category: parsed.data.category, closes_at: parsed.data.closesAt,
    resolution_source: parsed.data.resolutionSource, initial_probability: parsed.data.initialProbability,
    featured: parsed.data.featured, created_by: viewer.id,
  }).select("id").single();
  if (error) redirect("/admin?error=market-failed");
  await admin.from("audit_log").insert({ actor_id: viewer.id, action: "market.created", target_type: "market", target_id: data.id });
  revalidatePath("/"); revalidatePath("/admin"); redirect("/admin?success=market-created");
}

export async function resolveMarket(formData: FormData) {
  const viewer = await requireAdmin();
  const parsed = z.object({ marketId: z.uuid(), outcome: z.enum(["yes", "no", "void"]) }).safeParse({ marketId: formData.get("marketId"), outcome: formData.get("outcome") });
  if (!parsed.success) redirect("/admin?error=invalid-resolution");
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("settle_market", { p_admin_id: viewer.id, p_market_id: parsed.data.marketId, p_outcome: parsed.data.outcome });
  if (error) redirect("/admin?error=resolution-failed");
  revalidatePath("/"); revalidatePath("/admin"); redirect("/admin?success=resolved");
}
