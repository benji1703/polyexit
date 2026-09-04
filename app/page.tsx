import { MarketFloor } from "@/components/polyexit/market-floor";
import { getOpenMarkets } from "@/data/markets";
import { requireViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await requireViewer();
  const markets = await getOpenMarkets(viewer.id);
  return <MarketFloor viewer={{ displayName: viewer.displayName, balance: viewer.balance, role: viewer.role }} markets={markets} />;
}
