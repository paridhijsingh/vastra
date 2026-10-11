import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";
import {
  backendDeleteDictionaryEntry,
  backendGetDictionaryEntry,
  backendPatchDictionaryEntry,
} from "@/lib/dictionary/backend";
import { readDictionaryPatchBody } from "@/lib/dictionary/form";
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

function mutationStatus(kind: string, status: number): number {
  if (status === 404 || kind === "not_found") return 404;
  if (status === 403 || kind === "forbidden") return 403;
  if (kind === "validation") return 422;
  if (kind === "unavailable") return 503;
  return 502;
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  }

  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) {
    return tokenOrResponse;
  }

  const { entryId } = await context.params;
  if (!entryId?.trim()) {
    return jsonPrivate({ error: "Entry id is required." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonPrivate({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = readDictionaryPatchBody(body);
  if (!parsed.ok) {
    return jsonPrivate(
      { error: parsed.error, kind: "validation", fields: parsed.fields },
      { status: 422 },
    );
  }

  const result = await backendPatchDictionaryEntry(tokenOrResponse, entryId, parsed.body);
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      return unauthorizedSessionResponse(result.message);
    }
    return jsonPrivate(
      { error: result.message, kind: result.kind, fields: result.fields },
      { status: mutationStatus(result.kind, result.status) },
    );
  }

  return jsonPrivate({ entry: result.data }, { status: 200 });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  }

  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) {
    return tokenOrResponse;
  }

  const { entryId } = await context.params;
  if (!entryId?.trim()) {
    return jsonPrivate({ error: "Entry id is required." }, { status: 400 });
  }

  const result = await backendDeleteDictionaryEntry(tokenOrResponse, entryId);
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      return unauthorizedSessionResponse(result.message);
    }
    return jsonPrivate(
      { error: result.message, kind: result.kind },
      { status: mutationStatus(result.kind, result.status) },
    );
  }

  return jsonPrivate({ ok: true }, { status: 200 });
}
