import { NextResponse } from "next/server";

import { backendLogin, backendMe } from "@/lib/auth/backend";
import { AUTH_COOKIE_NAME, authCookieOptions } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";

export const runtime = "nodejs";

type Body = {
  username?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 },
    );
  }

  const loginResult = await backendLogin(username, password);
  if (!loginResult.ok) {
    const status =
      loginResult.kind === "invalid_credentials"
        ? 401
        : loginResult.kind === "unavailable"
          ? 503
          : loginResult.kind === "validation"
            ? 422
            : 400;
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

  // Token stays in an HttpOnly cookie only — never in the JSON body.
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
