import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";
import { backendCreateLook, backendListLooks, proxyStatus } from "@/lib/looks/backend";
import { lookFromApi, looksFromApi, readLookCreate } from "@/lib/looks/form";
import { jsonPrivate, unauthorizedSessionResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireToken(): Promise<string | NextResponse> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return unauthorizedSessionResponse("Your session has expired. Please sign in again.");
  }
  return token;
}

export async function GET() {
  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;
  const result = await backendListLooks(tokenOrResponse);
  if (!result.ok) {
    if (result.kind === "unauthorized") return unauthorizedSessionResponse(result.message);
    return jsonPrivate({ error: result.message, kind: result.kind }, { status: proxyStatus(result) });
  }
  const looks = looksFromApi(result.data);
  if (!looks) {
    return jsonPrivate(
      { error: "Saved looks are temporarily unavailable. Please try again later.", kind: "unknown" },
      { status: 502 },
    );
  }
  return jsonPrivate({ looks }, { status: 200 });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  }
  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonPrivate({ error: "Invalid request body.", kind: "validation" }, { status: 400 });
  }
  const parsed = readLookCreate(body);
  if (!parsed.ok) {
    return jsonPrivate(
      { error: parsed.error, kind: "validation", fields: parsed.fields },
      { status: parsed.status },
    );
  }
  const result = await backendCreateLook(tokenOrResponse, parsed.body);
  if (!result.ok) {
    if (result.kind === "unauthorized") return unauthorizedSessionResponse(result.message);
    return jsonPrivate(
      { error: result.message, kind: result.kind, fields: result.fields },
      { status: proxyStatus(result) },
    );
  }
  const look = lookFromApi(result.data);
  if (!look) {
    return jsonPrivate(
      { error: "Saved looks are temporarily unavailable. Please try again later.", kind: "unknown" },
      { status: 502 },
    );
  }
  return jsonPrivate({ look }, { status: 201 });
}
