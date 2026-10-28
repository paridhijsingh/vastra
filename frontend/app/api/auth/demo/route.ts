import { NextResponse } from "next/server";

import { backendDemoLogin, backendMe } from "@/lib/auth/backend";
import { AUTH_COOKIE_NAME, authCookieOptions } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const loginResult = await backendDemoLogin();
  if (!loginResult.ok) {
    const status = loginResult.kind === "unavailable" ? 503 : 400;
    return NextResponse.json(
      { error: loginResult.message, kind: loginResult.kind },
      { status },
    );
  }

  const meResult = await backendMe(loginResult.data.accessToken);
  if (!meResult.ok) {
    return NextResponse.json(
      {
        error:
          meResult.kind === "unavailable"
            ? meResult.message
            : "Could not establish a session. Please try again.",
        kind: meResult.kind,
      },
      { status: meResult.kind === "unavailable" ? 503 : 502 },
    );
  }

  const response = NextResponse.json(
    { user: { id: meResult.data.id, username: meResult.data.username } },
    { status: 200 },
  );
  response.cookies.set(
    AUTH_COOKIE_NAME,
    loginResult.data.accessToken,
    authCookieOptions(),
  );
  return response;
}
