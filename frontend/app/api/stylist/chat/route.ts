import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";
import { jsonPrivate, unauthorizedSessionResponse } from "@/lib/http";
import { backendStylistChat, proxyStatus } from "@/lib/stylist/backend";
import { historyForRequest, messageError, STYLIST_HISTORY_MAX, type StylistTurn } from "@/lib/stylist/form";

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

function readHistory(value: unknown): StylistTurn[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  if (value.length > STYLIST_HISTORY_MAX) return null;
  const turns: StylistTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as { role?: unknown; content?: unknown };
    if (record.role !== "user" && record.role !== "assistant") return null;
    if (typeof record.content !== "string") return null;
    const content = record.content.trim();
    if (!content || content.length > 2000) return null;
    turns.push({ role: record.role, content });
  }
  return turns;
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
  if (!body || typeof body !== "object") {
    return jsonPrivate({ error: "Invalid request body.", kind: "validation" }, { status: 400 });
  }
  const record = body as { message?: unknown; history?: unknown; profile?: unknown; wardrobe?: unknown };
  if ("profile" in record || "wardrobe" in record || "owner_id" in record) {
    return jsonPrivate({ error: "Check the message and try again.", kind: "validation" }, { status: 422 });
  }
  if (typeof record.message !== "string") {
    return jsonPrivate({ error: "Check the message and try again.", kind: "validation" }, { status: 422 });
  }
  const error = messageError(record.message);
  if (error) {
    return jsonPrivate({ error, kind: "validation" }, { status: 422 });
  }
  const history = readHistory(record.history);
  if (!history) {
    return jsonPrivate({ error: "Check the message and try again.", kind: "validation" }, { status: 422 });
  }

  const result = await backendStylistChat(
    tokenOrResponse,
    record.message.trim(),
    historyForRequest(history, record.message),
  );
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      return unauthorizedSessionResponse(result.message);
    }
    return jsonPrivate({ error: result.message, kind: result.kind }, { status: proxyStatus(result) });
  }
  return jsonPrivate({ reply: result.reply }, { status: 200 });
}
