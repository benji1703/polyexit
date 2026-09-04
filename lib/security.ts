import "server-only";
import { createHmac } from "node:crypto";

export function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function getAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string) {
  return getAdminEmails().has(normalizeEmail(email));
}

export function safeRelativePath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, "https://polyexit.invalid");
    return parsed.origin === "https://polyexit.invalid"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/";
  } catch {
    return "/";
  }
}

export function rateLimitKey(namespace: string, identifier: string) {
  const secret = process.env.RATE_LIMIT_HMAC_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("RATE_LIMIT_HMAC_SECRET must be at least 32 characters.");
  }
  return createHmac("sha256", secret)
    .update(`${namespace}:${identifier}`)
    .digest("hex");
}

