// Client-side environment helpers. Centralised so we surface clear errors when
// a deploy is missing a required value rather than silently failing at runtime.

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const POLYGON_RPC_URL =
  process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon-rpc.com";

// Optional: drop a Plausible script tag in <head> when this is set. Default
// host is plausible.io's; override for self-hosted instances. No-op otherwise.
export const PLAUSIBLE_DOMAIN =
  process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? "";
export const PLAUSIBLE_SCRIPT_SRC =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC ??
  "https://plausible.io/js/script.js";

export const isPrivyConfigured = PRIVY_APP_ID.length > 0;
export const isPlausibleConfigured = PLAUSIBLE_DOMAIN.length > 0;
