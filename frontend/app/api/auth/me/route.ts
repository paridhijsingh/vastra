import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { backendMe } from "@/lib/auth/backend";
import {
  AUTH_COOKIE_NAME,
  clearedAuthCookieOptions,
} from "@/lib/auth/cookies";

export const runtime = "nodejs";

export async function GET() {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const result = await backendMe(token);
  if (!result.ok) {
    const response = NextResponse.json(
      {
        user: null,
        error:
          result.kind === "unauthorized"
            ? "Your session has expired. Please sign in again."
            : result.message,
        kind: result.kind,
      },
      { status: result.kind === "unauthorized" ? 401 : result.status === 503 ? 503 : 200 },
    );
    if (result.kind === "unauthorized") {
      response.cookies.set(AUTH_COOKIE_NAME, "", clearedAuthCookieOptions());
    }
    return response;
  }

  return NextResponse.json(
    { user: { id: result.data.id, username: result.data.username } },
    { status: 200 },
  );
}
