import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";
import { jsonPrivate, unauthorizedSessionResponse } from "@/lib/http";
import { backendDeletePreference, backendUpdatePreference } from "@/lib/preferences/backend";
import { preferenceFromApi, reviewPreference, type PreferenceDraft } from "@/lib/preferences/form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ preferenceId: string }> };

async function requireToken(): Promise<string | NextResponse> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedSessionResponse("Your session has expired. Please sign in again.");
  return token;
}

export async function PATCH(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  const token = await requireToken();
  if (token instanceof NextResponse) return token;
  const { preferenceId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonPrivate({ error: "Check the preference and try again.", kind: "validation" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || "owner_id" in body) {
    return jsonPrivate({ error: "Check the preference and try again.", kind: "validation" }, { status: 422 });
  }
  const record = body as Partial<PreferenceDraft>;
  const decision = reviewPreference({
    topic: record.topic ?? "comfort",
    statement: typeof record.statement === "string" ? record.statement : "",
    occasion: typeof record.occasion === "string" ? record.occasion : "",
  });
  if (decision.status === "invalid") {
    return jsonPrivate({ error: "Check the preference and try again.", kind: "validation", fields: decision.errors }, { status: 422 });
  }
  const result = await backendUpdatePreference(token, preferenceId, decision.body);
  if (!result.ok) {
    if (result.kind === "unauthorized") return unauthorizedSessionResponse(result.message);
    const status = result.kind === "not_found" ? 404 : result.kind === "validation" ? 422 : 503;
    return jsonPrivate({ error: result.message, kind: result.kind }, { status });
  }
  const preference = preferenceFromApi(result.data);
  if (!preference) return jsonPrivate({ error: "Preferences could not be saved. Please try again.", kind: "unavailable" }, { status: 502 });
  return jsonPrivate({ preference });
}

export async function DELETE(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  const token = await requireToken();
  if (token instanceof NextResponse) return token;
  const { preferenceId } = await context.params;
  const result = await backendDeletePreference(token, preferenceId);
  if (!result.ok) {
    if (result.kind === "unauthorized") return unauthorizedSessionResponse(result.message);
    return jsonPrivate({ error: result.message, kind: result.kind }, { status: result.kind === "not_found" ? 404 : 503 });
  }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store, private" } });
}
