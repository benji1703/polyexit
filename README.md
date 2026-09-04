# Polyexit

An invite-only, coin-only prediction room for colleagues. Coins cannot be purchased, transferred, sold, or redeemed.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS, and shadcn primitives
- Supabase Auth (email magic links) and Postgres
- Vercel deployment

## Security model

- Exact-email invitation allowlist; no markets or participant data render before server-side session and profile checks.
- The Supabase publishable key is used only for Auth. All product tables have RLS enabled and grant no access to `anon` or `authenticated`; a small server-only data layer uses the service role after authorization.
- Coin balance changes, positions, settlement payouts, and audit records are atomic database functions.
- HMAC-pseudonymous rate-limit keys, strict input schemas, one-position-per-market limits, CSP, clickjacking protection, and no indexing.
- People markets require the administrator to confirm that named participants explicitly opted in.

## Setup

1. Create a Supabase project and apply `supabase/migrations/20260903203000_initial_secure_schema.sql`.
2. Copy `.env.example` to `.env.local` and set the Supabase URL, publishable key, service-role key, a 32+ character rate-limit secret, canonical URL, and bootstrap administrator email.
3. Add `http://localhost:3000/auth/callback` and the production callback URL to Supabase Auth redirect URLs.
4. Run `npm run dev`.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```
