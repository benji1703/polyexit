"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimitKey } from "@/lib/security";

const positionSchema = z.object({ marketId: z.uuid(), outcome: z.enum(["yes", "no"]), stake: z.number().int().min(10).max(1000) });
export type BetResult = { ok: true; balance: number } | { ok: false; message: string };

export async function placeBet(input: unknown): Promise<BetResult> {
  const viewer = await requireViewer();
  const parsed = positionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That prediction is not valid." };
  try {
    const admin = createSupabaseAdminClient();
    const { data: allowed } = await admin.rpc("consume_rate_limit", {
      p_key: rateLimitKey("position", viewer.id), p_limit: 12, p_window_seconds: 60,
    });
    if (!allowed) return { ok: false, message: "Slow down for a moment, then try again." };
    const { data, error } = await admin.rpc("place_position", {
      p_user_id: viewer.id, p_market_id: parsed.data.marketId,
      p_outcome: parsed.data.outcome, p_stake: parsed.data.stake,
    });
    if (error) {
      if (error.message.includes("already has a position")) return { ok: false, message: "You already made a call on this market." };
      if (error.message.includes("Insufficient")) return { ok: false, message: "You don’t have enough coins for that stake." };
      if (error.message.includes("closed")) return { ok: false, message: "This market is already closed." };
      throw error;
    }
    revalidatePath("/");
    return { ok: true, balance: Number(data) };
  } catch {
    return { ok: false, message: "We couldn’t place that prediction. No coins were moved." };
  }
}

