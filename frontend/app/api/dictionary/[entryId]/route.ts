import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { backendGetDictionaryEntry } from "@/lib/dictionary/backend";
import { jsonPrivate, unauthorizedSessionResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

async function requireToken(): Promise<string | NextResponse> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return unauthorizedSessionResponse(
      "Your session has expired. Please sign in again.",
    );
  }
  return token;
}

export async function GET(_request: Request, context: RouteContext) {
  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) {
    return tokenOrResponse;
  }

  const { entryId } = await context.params;
  const result = await backendGetDictionaryEntry(tokenOrResponse, entryId);
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      return unauthorizedSessionResponse(result.message);
    }
    return jsonPrivate(
      { error: result.message, kind: result.kind },
      {
        status:
          result.kind === "not_found"
            ? 404
            : result.kind === "unavailable"
              ? 503
              : 502,
      },
    );
  }

  return jsonPrivate({ entry: result.data }, { status: 200 });
}
