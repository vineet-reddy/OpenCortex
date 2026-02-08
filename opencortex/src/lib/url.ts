/**
 * Resolve the canonical base URL for this OpenCortex deployment.
 *
 * Priority:
 *  1. NEXT_PUBLIC_APP_URL  – explicit override (set in Vercel project settings)
 *  2. VERCEL_URL           – auto-set by Vercel on every deployment
 *  3. localhost fallback   – local development
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT || 3000}`;
}
