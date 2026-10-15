import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";
import { backendDeleteEvent, backendGetEvent, backendUpdateEvent, proxyStatus } from "@/lib/events/backend";
import { eventFromApi, readEventPatch } from "@/lib/events/form";
import { jsonPrivate, unauthorizedSessionResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ eventId: string }> };

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
  const { eventId } = await context.params;
  if (!eventId) return jsonPrivate({ error: "Event id is required." }, { status: 400 });
  const result = await backendGetEvent(tokenOrResponse, eventId);
  if (!result.ok) {
    if (result.kind === "unauthorized") return unauthorizedSessionResponse(result.message);
    return jsonPrivate({ error: result.message, kind: result.kind }, { status: proxyStatus(result) });
  }
  const event = eventFromApi(result.data);
  if (!event) {
    return jsonPrivate(
      { error: "Saved events are temporarily unavailable. Please try again later.", kind: "unknown" },
      { status: 502 },
    );
  }
  return jsonPrivate({ event }, { status: 200 });
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  }
  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;
  const { eventId } = await context.params;
  if (!eventId) return jsonPrivate({ error: "Event id is required." }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonPrivate({ error: "Invalid request body.", kind: "validation" }, { status: 400 });
  }
  const parsed = readEventPatch(body);
  if (!parsed.ok) {
    return jsonPrivate(
      { error: parsed.error, kind: "validation", fields: parsed.fields },
      { status: parsed.status },
    );
  }
  const result = await backendUpdateEvent(tokenOrResponse, eventId, parsed.body);
  if (!result.ok) {
    if (result.kind === "unauthorized") return unauthorizedSessionResponse(result.message);
    return jsonPrivate(
      { error: result.message, kind: result.kind, fields: result.fields },
      { status: proxyStatus(result) },
    );
  }
  const event = eventFromApi(result.data);
  if (!event) {
    return jsonPrivate(
      { error: "Saved events are temporarily unavailable. Please try again later.", kind: "unknown" },
      { status: 502 },
    );
  }
  return jsonPrivate({ event }, { status: 200 });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  }
  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;
  const { eventId } = await context.params;
  if (!eventId) return jsonPrivate({ error: "Event id is required." }, { status: 400 });
  const result = await backendDeleteEvent(tokenOrResponse, eventId);
  if (!result.ok) {
    if (result.kind === "unauthorized") return unauthorizedSessionResponse(result.message);
    return jsonPrivate({ error: result.message, kind: result.kind }, { status: proxyStatus(result) });
  }
  return jsonPrivate({ ok: true }, { status: 200 });
}
