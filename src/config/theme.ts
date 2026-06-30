// White-label theming: apply a tenant's brand tokens by setting CSS variables
// on :root. Components never hard-code colors — they read the tokens defined in
// src/index.css, so re-skinning a tenant is a data change, not a code change.

import type { Tenant } from "@/data/types";

export function applyTenantTheme(tenant: Tenant | null | undefined) {
  const root = document.documentElement;
  // Reset to house default, then layer tenant overrides.
  const brand = tenant?.branding?.brand;
  if (brand) {
    root.style.setProperty("--brand", brand);
  } else {
    root.style.removeProperty("--brand");
  }
}
