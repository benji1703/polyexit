"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { requestMagicLink, type SignInState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignInState = { status: "idle", message: "" };

export function SignInForm() {
  const [state, action, pending] = useActionState(requestMagicLink, initialState);

  return (
    <form action={action} className="signin-form">
      <div className="field-stack">
        <Label htmlFor="email">Invited email</Label>
        <div className="input-shell">
          <Mail size={16} aria-hidden="true" />
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            maxLength={254}
          />
        </div>
      </div>
      <Button className="signin-button" size="lg" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
        {pending ? "Sending…" : "Send secure link"}
      </Button>
      <p className={`form-message ${state.status}`} aria-live="polite">
        {state.message || "No password to lose. Links expire and work once."}
      </p>
    </form>
  );
}

