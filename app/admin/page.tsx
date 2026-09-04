import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { createMarket, inviteMember, resolveMarket } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const messages: Record<string, string> = { invited: "Invitation allowlisted.", "market-created": "Market opened.", resolved: "Market settled atomically." };
const errors: Record<string, string> = { "invalid-invite": "Check the email and role.", "invite-failed": "Invitation could not be saved.", "invalid-market": "Complete every market field.", "opt-in-required": "People markets require confirmed consent.", "market-failed": "Market could not be created.", "invalid-resolution": "Choose a valid resolution.", "resolution-failed": "Settlement failed; no balances were changed." };

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const admin = createSupabaseAdminClient();
  const [{ data: invitations }, { data: markets }] = await Promise.all([
    admin.from("invitations").select("email,role,status,created_at").order("created_at", { ascending: false }).limit(20),
    admin.from("markets").select("id,title,status,closes_at").eq("status", "open").order("closes_at", { ascending: true }),
  ]);
  return <main className="admin-page">
    <header className="admin-header"><Link className="brand" href="/"><span className="brand-mark">P/X</span><span>Polyexit</span></Link><Link href="/"><ArrowLeft size={14} /> Back to markets</Link></header>
    <div className="admin-intro"><p className="eyebrow">Private control room</p><h1>Admin</h1><p><ShieldCheck size={16} /> Every action is authorized server-side and recorded.</p></div>
    {params.success && messages[params.success] ? <p className="admin-notice success">{messages[params.success]}</p> : null}
    {params.error && errors[params.error] ? <p className="admin-notice error">{errors[params.error]}</p> : null}
    <div className="admin-grid">
      <section className="admin-card"><p className="eyebrow">Access</p><h2>Allow a colleague</h2><p>Add the exact address. They can then request their own verified magic link.</p><form action={inviteMember} className="admin-form"><label>Email<input name="email" type="email" required maxLength={254} placeholder="colleague@company.com" /></label><label>Role<select name="role" defaultValue="member"><option value="member">Member</option><option value="moderator">Moderator</option></select></label><button type="submit">Add to allowlist</button></form><div className="admin-list">{invitations?.map((invite) => <div key={invite.email}><span>{invite.email}</span><small>{invite.role} · {invite.status}</small></div>)}</div></section>
      <section className="admin-card"><p className="eyebrow">Market</p><h2>Open a forecast</h2><form action={createMarket} className="admin-form"><label>Question<input name="title" required minLength={10} maxLength={140} /></label><label>Context<textarea name="description" required minLength={20} maxLength={600} rows={3} /></label><div className="form-split"><label>Category<select name="category" defaultValue="secondary"><option value="secondary">Secondary</option><option value="company">Company</option><option value="people">People · opt-in</option></select></label><label>Starting chance<input name="initialProbability" type="number" defaultValue="50" min="5" max="95" /></label></div><label>Close at<input name="closesAt" type="datetime-local" required /></label><label>Written resolution source<input name="resolutionSource" required minLength={10} maxLength={300} placeholder="Formal all-hands announcement" /></label><label className="check-label"><input name="optInConfirmed" type="checkbox" /> Any named person explicitly consented</label><label className="check-label"><input name="featured" type="checkbox" /> Feature this market</label><button type="submit">Open market</button></form></section>
    </div>
    <section className="admin-card settlements"><p className="eyebrow">Settlement</p><h2>Resolve open markets</h2><p>A settlement cannot be undone from the UI. Payouts and the audit trail commit together.</p><div className="settlement-list">{markets?.map((market) => <div key={market.id}><span>{market.title}</span><form action={resolveMarket}><input type="hidden" name="marketId" value={market.id} /><select name="outcome" aria-label={`Outcome for ${market.title}`}><option value="yes">Yes</option><option value="no">No</option><option value="void">Void / refund</option></select><button type="submit">Settle</button></form></div>)}</div></section>
  </main>;
}
