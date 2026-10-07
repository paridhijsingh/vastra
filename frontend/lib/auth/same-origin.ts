/**
 * Reject cross-site state-changing requests.
 * Browsers send Origin on CORS/fetch; Sec-Fetch-Site or Referer cover same-origin forms.
 */
export function isSameOriginRequest(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) {
    return false;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "none") {
    return true;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  return false;
}
