import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";
import { jsonPrivate, unauthorizedSessionResponse } from "@/lib/http";
import { backendCreatePreference, backendListPreferences } from "@/lib/preferences/backend";
import { preferenceFromApi, reviewPreference, type PreferenceDraft } from "@/lib/preferences/form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireToken(): Promise<string | NextResponse> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedSessionResponse("Your session has expired. Please sign in again.");
  return token;
}

function guard(request: Request): NextResponse | null {
  if (!isSameOriginRequest(request)) return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const token = await requireToken();
  if (token instanceof NextResponse) return token;
  const result = await backendListPreferences(token);
  if (!result.ok) {
    if (result.kind === "unauthorized") return unauthorizedSessionResponse(result.message);
    return jsonPrivate({ error: result.message, kind: result.kind }, { status: result.status === 401 ? 401 : 503 });
  }
  if (!Array.isArray(result.data)) {
    return jsonPrivate({ error: "Preferences could not be loaded. Please try again.", kind: "unavailable" }, { status: 502 });
  }
  const preferences = result.data.map(preferenceFromApi);
  if (preferences.some((item) => item === null)) {
    return jsonPrivate({ error: "Preferences could not be loaded. Please try again.", kind: "unavailable" }, { status: 502 });
  }
  return jsonPrivate({ preferences });
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const token = await requireToken();
  if (token instanceof NextResponse) return token;
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
  if (decision.status === "invalid" || record.topic === undefined) {
    return jsonPrivate({ error: "Check the preference and try again.", kind: "validation", fields: decision.status === "invalid" ? decision.errors : {} }, { status: 422 });
  }
  const result = await backendCreatePreference(token, decision.body);
  if (!result.ok) {
    if (result.kind === "unauthorized") return unauthorizedSessionResponse(result.message);
    return jsonPrivate({ error: result.message, kind: result.kind }, { status: result.kind === "conflict" ? 409 : result.kind === "validation" ? 422 : 503 });
  }
  const preference = preferenceFromApi(result.data);
  if (!preference) return jsonPrivate({ error: "Preferences could not be saved. Please try again.", kind: "unavailable" }, { status: 502 });
  return jsonPrivate({ preference }, { status: 201 });
}
