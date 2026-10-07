/** Server-only configuration. Do not import into client components. */

const DEFAULT_API_URL = "http://127.0.0.1:8000";
const DEFAULT_COOKIE_HOURS = 72;

export function getApiUrl(): string {
  const raw = process.env.API_URL?.trim();
  if (!raw) {
    return DEFAULT_API_URL;
  }
  return raw.replace(/\/$/, "");
}

export function getAuthCookieMaxAgeSeconds(): number {
  const raw = process.env.AUTH_COOKIE_MAX_AGE_HOURS?.trim();
  const hours = raw ? Number.parseInt(raw, 10) : DEFAULT_COOKIE_HOURS;
  if (!Number.isFinite(hours) || hours <= 0) {
    return DEFAULT_COOKIE_HOURS * 60 * 60;
  }
  return hours * 60 * 60;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
