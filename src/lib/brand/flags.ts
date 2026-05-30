// src/lib/brand/flags.ts
// Feature flags for new Ripple Nexus modules.
// When ENABLE_RN_MODULE is not set or is 'false', all RN UI is hidden.
// This file is NEW — safe to add with zero impact on existing code.

/** Returns true only when RN module is explicitly enabled via env var. */
export function isRnModuleEnabled(): boolean {
  return process.env.ENABLE_RN_MODULE === 'true';
}

/** Client-safe version — reads from NEXT_PUBLIC_ prefix */
export function isRnModuleEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_RN_MODULE === 'true';
}
