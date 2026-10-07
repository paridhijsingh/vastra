import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  clearedAuthCookieOptions,
} from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";

export const runtime = "nodejs";

/**
 * Clears the browser session cookie.
 * This does not revoke the JWT on the FastAPI backend.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const response = NextResponse.json(
    {
      ok: true,
      message:
        "Signed out. The browser session cookie was cleared. The backend access token is not revoked.",
    },
    { status: 200 },
  );
  response.cookies.set(AUTH_COOKIE_NAME, "", clearedAuthCookieOptions());
  return response;
}
