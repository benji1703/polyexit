import { Coins, Fingerprint, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentViewer } from "@/lib/auth";
import { SignInForm } from "@/components/polyexit/sign-in-form";

const messages: Record<string, string> = {
  "invalid-link": "That sign-in link is invalid or expired. Request a fresh one.",
  "not-invited": "This space is invite-only. Ask an administrator to add your email.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const viewer = await getCurrentViewer();
  if (viewer) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="signin-page">
      <section className="signin-brand-panel" aria-label="About Polyexit">
        <Link className="brand signin-brand" href="/">
          <span className="brand-mark" aria-hidden="true">P/X</span>
          <span>Polyexit</span>
        </Link>
        <div className="signin-statement">
          <p className="eyebrow">A private prediction room</p>
          <h1>Put your coins where your hunch is.</h1>
          <p>Forecast company moments with colleagues—for bragging rights, never money.</p>
        </div>
        <div className="signin-proof">
          <span><Coins /> No purchases or cash value</span>
          <span><ShieldCheck /> Explicit invite allowlist</span>
          <span><Fingerprint /> Verified, revocable identity</span>
        </div>
      </section>
      <section className="signin-access-panel">
        <div className="signin-box">
          <p className="eyebrow">Team access</p>
          <h2>Sign in</h2>
          <p className="signin-help">Use the email your administrator invited. We’ll send a one-time Supabase magic link.</p>
          {error && messages[error] ? <p className="auth-error" role="alert">{messages[error]}</p> : null}
          <SignInForm />
          <div className="privacy-note">
            <ShieldCheck size={16} aria-hidden="true" />
            <p>Markets, balances, and names stay hidden until your invitation and session are verified server-side.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
