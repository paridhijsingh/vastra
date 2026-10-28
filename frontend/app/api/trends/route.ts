import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";
import { jsonPrivate, unauthorizedSessionResponse } from "@/lib/http";
import { backendCreateTrendIdea, proxyStatus } from "@/lib/trends/backend";
import { readTrendRequest } from "@/lib/trends/form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function requireToken(): Promise<string | NextResponse> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return unauthorizedSessionResponse("Your session has expired. Please sign in again.");
  }
  return token;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  }

  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) {
    return tokenOrResponse;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonPrivate({ error: "Invalid request body.", kind: "validation" }, { status: 400 });
  }

  const parsed = readTrendRequest(body);
  if (!parsed.ok) {
    return jsonPrivate(
      { error: parsed.error, kind: "validation", fields: parsed.fields },
      { status: parsed.status },
    );
  }

  const result = await backendCreateTrendIdea(tokenOrResponse, parsed.body);
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      return unauthorizedSessionResponse(result.message);
    }
    return jsonPrivate(
      { error: result.message, kind: result.kind, fields: result.fields },
      { status: proxyStatus(result) },
    );
  }

  return jsonPrivate({ idea: result.data }, { status: 200 });
}
