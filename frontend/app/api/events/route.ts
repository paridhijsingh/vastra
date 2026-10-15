import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";
import { backendCreateEvent, backendListEvents, proxyStatus } from "@/lib/events/backend";
import { eventFromApi, eventsFromApi, readEventCreate } from "@/lib/events/form";
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
  const result = await backendListEvents(tokenOrResponse);
  if (!result.ok) {
    if (result.kind === "unauthorized") return unauthorizedSessionResponse(result.message);
    return jsonPrivate({ error: result.message, kind: result.kind }, { status: proxyStatus(result) });
  }
  const events = eventsFromApi(result.data);
  if (!events) {
    return jsonPrivate(
      { error: "Saved events are temporarily unavailable. Please try again later.", kind: "unknown" },
      { status: 502 },
    );
  }
  return jsonPrivate({ events }, { status: 200 });
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
  const parsed = readEventCreate(body);
  if (!parsed.ok) {
    return jsonPrivate(
      { error: parsed.error, kind: "validation", fields: parsed.fields },
      { status: parsed.status },
    );
  }
  const result = await backendCreateEvent(tokenOrResponse, parsed.body);
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
  return jsonPrivate({ event }, { status: 201 });
}
