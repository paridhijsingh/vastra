import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  clearedAuthCookieOptions,
} from "@/lib/auth/cookies";

export const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-store",
} as const;

export function jsonPrivate(
  body: unknown,
  init?: { status?: number },
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: PRIVATE_NO_STORE_HEADERS,
  });
}

export function unauthorizedSessionResponse(message: string): NextResponse {
  const response = jsonPrivate(
    {
      error: message,
      kind: "unauthorized",
    },
    { status: 401 },
  );
  response.cookies.set(AUTH_COOKIE_NAME, "", clearedAuthCookieOptions());
  return response;
}
