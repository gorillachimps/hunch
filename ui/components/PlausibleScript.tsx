import Script from "next/script";
import {
  isPlausibleConfigured,
  PLAUSIBLE_DOMAIN,
  PLAUSIBLE_SCRIPT_SRC,
} from "@/lib/env-client";

/** Injects the Plausible analytics script when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is
 *  set. No-op otherwise. The default script src is plausible.io's public host;
 *  set NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC for self-hosted instances. */
export function PlausibleScript() {
  if (!isPlausibleConfigured) return null;
  return (
    <Script
      defer
      data-domain={PLAUSIBLE_DOMAIN}
      src={PLAUSIBLE_SCRIPT_SRC}
      strategy="afterInteractive"
    />
  );
}
