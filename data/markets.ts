import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { probabilityFromStakes } from "@/lib/market-math";

export type MarketCategory = "people" | "company" | "secondary";
export type MarketOutcome = "yes" | "no";
export type MarketCardDTO = {
  id: string; slug: string; category: MarketCategory; title: string; description: string;
  resolutionSource: string; closesAt: string; probability: number; yesStake: number;
  noStake: number; volume: number; featured: boolean;
  userPosition: { outcome: MarketOutcome; stake: number } | null;
};
type PositionRow = { market_id: string; user_id: string; outcome: MarketOutcome; stake: number };

export async function getOpenMarkets(viewerId: string): Promise<MarketCardDTO[]> {
  const admin = createSupabaseAdminClient();
  const { data: markets, error } = await admin
    .from("markets")
    .select("id,slug,category,title,description,resolution_source,closes_at,initial_probability,featured")
    .eq("status", "open").gt("closes_at", new Date().toISOString())
    .order("featured", { ascending: false }).order("closes_at", { ascending: true });
  if (error) throw error;
  if (!markets?.length) return [];

  const { data: positions, error: positionError } = await admin
    .from("positions").select("market_id,user_id,outcome,stake")
    .in("market_id", markets.map((market) => market.id));
  if (positionError) throw positionError;

  const byMarket = new Map<string, PositionRow[]>();
  for (const position of (positions ?? []) as PositionRow[]) {
    const list = byMarket.get(position.market_id) ?? [];
    list.push(position);
    byMarket.set(position.market_id, list);
  }

  return markets.map((market) => {
    const entries = byMarket.get(market.id) ?? [];
    const yesStake = entries.filter((p) => p.outcome === "yes").reduce((sum, p) => sum + p.stake, 0);
    const noStake = entries.filter((p) => p.outcome === "no").reduce((sum, p) => sum + p.stake, 0);
    const own = entries.find((p) => p.user_id === viewerId);
    return {
      id: market.id, slug: market.slug, category: market.category, title: market.title,
      description: market.description, resolutionSource: market.resolution_source,
      closesAt: market.closes_at,
      probability: probabilityFromStakes(yesStake, noStake, market.initial_probability),
      yesStake, noStake, volume: yesStake + noStake, featured: market.featured,
      userPosition: own ? { outcome: own.outcome, stake: own.stake } : null,
    } as MarketCardDTO;
  });
}

