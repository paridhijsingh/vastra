import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";
import { backendDeleteLook, backendGetLook, backendUpdateLook, proxyStatus } from "@/lib/looks/backend";
import { lookFromApi, readLookPatch } from "@/lib/looks/form";
import { jsonPrivate, unauthorizedSessionResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ lookId: string }> };

async function requireToken(): Promise<string | NextResponse> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return unauthorizedSessionResponse("Your session has expired. Please sign in again.");
  }
  return token;
}

export async function GET(_request: Request, context: RouteContext) {
  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;
  const { lookId } = await context.params;
  if (!lookId) return jsonPrivate({ error: "Look id is required." }, { status: 400 });
  const result = await backendGetLook(tokenOrResponse, lookId);
  if (!result.ok) {
    if (result.kind === "unauthorized") return unauthorizedSessionResponse(result.message);
    return jsonPrivate({ error: result.message, kind: result.kind }, { status: proxyStatus(result) });
  }
  const look = lookFromApi(result.data);
  if (!look) {
    return jsonPrivate(
      { error: "Saved looks are temporarily unavailable. Please try again later.", kind: "unknown" },
      { status: 502 },
    );
  }
  return jsonPrivate({ look }, { status: 200 });
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  }
  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;
  const { lookId } = await context.params;
  if (!lookId) return jsonPrivate({ error: "Look id is required." }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonPrivate({ error: "Invalid request body.", kind: "validation" }, { status: 400 });
  }
  const parsed = readLookPatch(body);
  if (!parsed.ok) {
    return jsonPrivate(
      { error: parsed.error, kind: "validation", fields: parsed.fields },
      { status: parsed.status },
    );
  }
  const result = await backendUpdateLook(tokenOrResponse, lookId, parsed.body);
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
  return jsonPrivate({ look }, { status: 200 });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  }
  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;
  const { lookId } = await context.params;
  if (!lookId) return jsonPrivate({ error: "Look id is required." }, { status: 400 });
  const result = await backendDeleteLook(tokenOrResponse, lookId);
  if (!result.ok) {
    if (result.kind === "unauthorized") return unauthorizedSessionResponse(result.message);
    return jsonPrivate({ error: result.message, kind: result.kind }, { status: proxyStatus(result) });
  }
  return jsonPrivate({ ok: true }, { status: 200 });
}
