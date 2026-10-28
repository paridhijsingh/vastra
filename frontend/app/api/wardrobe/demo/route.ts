import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";
import { jsonPrivate, unauthorizedSessionResponse } from "@/lib/http";
import { backendLoadDemoWardrobe } from "@/lib/wardrobe/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  }

  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return unauthorizedSessionResponse("Your session has expired. Please sign in again.");
  }

  const result = await backendLoadDemoWardrobe(token);
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      return unauthorizedSessionResponse(result.message);
    }
    const status =
      result.kind === "conflict" ? 409 : result.kind === "unavailable" ? 503 : 502;
    return jsonPrivate({ error: result.message, kind: result.kind }, { status });
  }

  return jsonPrivate({ items: result.data }, { status: 201 });
}
