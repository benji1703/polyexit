"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Coins, LockKeyhole, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { placeBet } from "@/app/actions/bets";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import type { MarketCardDTO, MarketCategory, MarketOutcome } from "@/data/markets";
import { projectedPayout } from "@/lib/market-math";

type Props = { viewer: { displayName: string; balance: number; role: string }; markets: MarketCardDTO[] };
const labels: Record<MarketCategory, string> = { people: "People · opt-in", company: "Company", secondary: "Secondary" };
const tones: Record<MarketCategory, string> = { people: "coral", company: "violet", secondary: "lime" };
function daysLeft(value: string) { const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000); return days <= 1 ? "Closes today" : `Closes in ${days} days`; }

export function MarketFloor({ viewer, markets }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | MarketCategory>("all");
  const [selection, setSelection] = useState<{ market: MarketCardDTO; outcome: MarketOutcome } | null>(null);
  const [stake, setStake] = useState(100);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(() => markets.filter((m) => filter === "all" || m.category === filter), [filter, markets]);
  const featured = markets.find((market) => market.featured) ?? markets[0];
  const selectedPool = selection ? (selection.outcome === "yes" ? selection.market.yesStake : selection.market.noStake) : 0;
  const oppositePool = selection ? (selection.outcome === "yes" ? selection.market.noStake : selection.market.yesStake) : 0;
  const payout = projectedPayout(stake, selectedPool, oppositePool);

  function openTrade(market: MarketCardDTO, outcome: MarketOutcome) { setStake(Math.min(100, viewer.balance)); setMessage(""); setSelection({ market, outcome }); }
  function submitTrade() {
    if (!selection) return;
    setMessage("");
    startTransition(async () => {
      const result = await placeBet({ marketId: selection.market.id, outcome: selection.outcome, stake });
      if (!result.ok) return setMessage(result.message);
      setMessage("Prediction locked. Your new balance is syncing now.");
      setTimeout(() => { setSelection(null); router.refresh(); }, 650);
    });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Polyexit home"><span className="brand-mark" aria-hidden="true">P/X</span><span>Polyexit</span></a>
        <nav className="topnav" aria-label="Main navigation"><a className="is-active" href="#markets">Markets</a><a href="#rules">Rules</a>{viewer.role === "admin" ? <a href="/admin"><Settings size={13} /> Admin</a> : null}</nav>
        <div className="account-actions"><button className="wallet" type="button" aria-label={`${viewer.balance} coin balance`}><Coins size={15} /><strong>{viewer.balance.toLocaleString()}</strong><span>coins</span></button><form action={signOut}><button className="signout" type="submit" title={`Signed in as ${viewer.displayName}`}>Sign out</button></form></div>
      </header>
      <section className="market-layout" id="top">
        <aside className="rail" aria-label="Market filters"><p className="eyebrow">Browse</p>
          {(["all", "people", "company", "secondary"] as const).map((value, index) => <button className={`rail-link ${filter === value ? "is-active" : ""}`} key={value} type="button" onClick={() => setFilter(value)}><span>0{index + 1}</span> {value === "all" ? "All markets" : labels[value]}</button>)}
          <div className="rail-note" id="rules"><LockKeyhole size={16} /><p><strong>Private by design.</strong> Invite-only, opt-in names, and coins with no cash value.</p></div>
        </aside>
        <div className="market-main" id="markets">
          <div className="intro-row"><div><p className="eyebrow"><span className="live-dot" /> The floor</p><h1>What does the room think?</h1></div><p className="intro-copy">Make a call. Stake bragging rights. Settle on verifiable outcomes.</p></div>
          {featured ? <article className="featured-card">
            <div className="featured-copy"><div className="card-meta"><span>Featured market</span><span>{daysLeft(featured.closesAt)}</span></div><h2>{featured.title}</h2><p>{featured.description}</p><div className="featured-actions"><button type="button" onClick={() => openTrade(featured, "yes")} disabled={Boolean(featured.userPosition)}><span>Yes</span><strong>{featured.probability}¢</strong></button><button type="button" onClick={() => openTrade(featured, "no")} disabled={Boolean(featured.userPosition)}><span>No</span><strong>{100 - featured.probability}¢</strong></button></div></div>
            <div className="probability-orbit" aria-label={`${featured.probability} percent probability`}><span className="orbit-label">chance</span><strong>{featured.probability}<span>%</span></strong><svg viewBox="0 0 220 92" role="img" aria-label="Market probability trend"><path d="M2 76 C28 72, 42 82, 67 61 S106 48, 123 52 S158 30, 178 36 S202 17, 218 12" /></svg><small>{featured.volume.toLocaleString()} coins staked</small></div>
          </article> : <div className="empty-market"><Sparkles /><h2>The floor is quiet.</h2><p>An admin can open the first market from the admin room.</p></div>}
          <div className="section-heading"><h2>Open markets <span>{filtered.length}</span></h2><button type="button">Closing soon <ArrowUpRight size={14} /></button></div>
          <div className="market-grid">{filtered.map((market) => <article className="market-card" key={market.id}><div className="card-meta"><span className={`tag ${tones[market.category]}`}>{labels[market.category]}</span><span>{market.volume.toLocaleString()} coins</span></div><h3>{market.title}</h3><div className="market-bottom"><div className="market-chance"><strong>{market.probability}%</strong><span>chance</span></div>{market.userPosition ? <span className="position-pill"><Check size={12} /> {market.userPosition.outcome} · {market.userPosition.stake}</span> : <div className="choice-pair" aria-label={`Predict ${market.title}`}><button type="button" className="yes" onClick={() => openTrade(market, "yes")}>Yes</button><button type="button" className="no" onClick={() => openTrade(market, "no")}>No</button></div>}</div></article>)}</div>
          <footer className="trust-strip"><span><ShieldCheck size={15} /> Playful, not payable</span><p>Coins cannot be bought, sold, gifted, or redeemed. Moderators settle markets against written rules.</p></footer>
        </div>
      </section>
      <Dialog open={Boolean(selection)} onOpenChange={(open) => !open && setSelection(null)}><DialogContent className="trade-dialog"><DialogHeader><p className="eyebrow">Lock your prediction</p><DialogTitle>{selection?.outcome === "yes" ? "Yes" : "No"} · {selection?.market.title}</DialogTitle><DialogDescription>{selection?.market.resolutionSource}</DialogDescription></DialogHeader><div className="trade-amount-row"><span>Stake</span><strong>{stake.toLocaleString()} coins</strong></div><Slider value={[stake]} min={10} max={Math.min(1000, viewer.balance)} step={10} onValueChange={(value) => setStake(Array.isArray(value) ? Number(value[0]) : Number(value))} aria-label="Coin stake" /><div className="trade-summary"><span>Estimated return if correct</span><strong>{payout.toLocaleString()} coins</strong><small>Estimate changes as the room makes predictions.</small></div>{message ? <p className="trade-message" aria-live="polite">{message}</p> : null}<DialogFooter><Button variant="outline" type="button" onClick={() => setSelection(null)}>Cancel</Button><Button type="button" disabled={pending || stake > viewer.balance} onClick={submitTrade}>{pending ? "Locking…" : "Lock prediction"}</Button></DialogFooter></DialogContent></Dialog>
    </main>
  );
}

