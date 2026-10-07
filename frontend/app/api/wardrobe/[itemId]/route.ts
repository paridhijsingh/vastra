import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";
import { jsonPrivate, unauthorizedSessionResponse } from "@/lib/http";
import {
  backendDeleteWardrobeItem,
  backendPatchWardrobeItem,
} from "@/lib/wardrobe/backend";
import {
  isAvailabilityStatus,
  isItemCategory,
  type WardrobeItemUpdate,
} from "@/lib/wardrobe/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ itemId: string }>;
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

function parsePatchPayload(body: unknown): WardrobeItemUpdate | string {
  if (!body || typeof body !== "object") {
    return "Invalid request body.";
  }
  const record = body as Record<string, unknown>;
  if ("owner_id" in record || "id" in record) {
    return "Ownership and item id cannot be set by the client.";
  }

  const patch: WardrobeItemUpdate = {};

  if ("name" in record) {
    if (typeof record.name !== "string" || !record.name.trim()) {
      return "name must be a non-empty string when provided.";
    }
    patch.name = record.name.trim();
  }
  if ("category" in record) {
    if (typeof record.category !== "string" || !isItemCategory(record.category)) {
      return "category must be a supported wardrobe category.";
    }
    patch.category = record.category;
  }
  if ("color" in record) {
    if (typeof record.color !== "string" || !record.color.trim()) {
      return "color must be a non-empty string when provided.";
    }
    patch.color = record.color.trim();
  }
  if ("notes" in record) {
    if (typeof record.notes !== "string") {
      return "notes must be a string when provided.";
    }
    // Empty string clears optional notes (backend contract).
    patch.notes = record.notes.trim();
  }
  if ("availability" in record) {
    if (
      typeof record.availability !== "string" ||
      !isAvailabilityStatus(record.availability)
    ) {
      return "availability must be available, in_laundry, or packed_away.";
    }
    patch.availability = record.availability;
  }

  if (Object.keys(patch).length === 0) {
    return "No fields to update.";
  }

  return patch;
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  }

  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) {
    return tokenOrResponse;
  }

  const { itemId } = await context.params;
  if (!itemId?.trim()) {
    return jsonPrivate({ error: "Item id is required." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonPrivate({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = parsePatchPayload(body);
  if (typeof parsed === "string") {
    return jsonPrivate({ error: parsed, kind: "validation" }, { status: 422 });
  }

  const result = await backendPatchWardrobeItem(
    tokenOrResponse,
    itemId,
    parsed,
  );
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      return unauthorizedSessionResponse(result.message);
    }
    return jsonPrivate(
      { error: result.message, kind: result.kind },
      {
        status:
          result.status === 404
            ? 404
            : result.kind === "validation"
              ? 422
              : result.kind === "unavailable"
                ? 503
                : 502,
      },
    );
  }

  return jsonPrivate({ item: result.data }, { status: 200 });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return jsonPrivate({ error: "Forbidden" }, { status: 403 });
  }

  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) {
    return tokenOrResponse;
  }

  const { itemId } = await context.params;
  if (!itemId?.trim()) {
    return jsonPrivate({ error: "Item id is required." }, { status: 400 });
  }

  const result = await backendDeleteWardrobeItem(tokenOrResponse, itemId);
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      return unauthorizedSessionResponse(result.message);
    }
    return jsonPrivate(
      { error: result.message, kind: result.kind },
      {
        status:
          result.status === 404
            ? 404
            : result.kind === "unavailable"
              ? 503
              : 502,
      },
    );
  }

  return jsonPrivate({ ok: true }, { status: 200 });
}
