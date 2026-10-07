import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/same-origin";
import { jsonPrivate, unauthorizedSessionResponse } from "@/lib/http";
import {
  backendCreateWardrobeItem,
  backendListWardrobe,
} from "@/lib/wardrobe/backend";
import {
  isAvailabilityStatus,
  isItemCategory,
  type AvailabilityStatus,
  type WardrobeItemCreate,
} from "@/lib/wardrobe/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function parseCreatePayload(body: unknown): WardrobeItemCreate | string {
  if (!body || typeof body !== "object") {
    return "Invalid request body.";
  }
  const record = body as Record<string, unknown>;
  if ("owner_id" in record || "id" in record) {
    return "Ownership and item id cannot be set by the client.";
  }

  if (typeof record.name !== "string" || !record.name.trim()) {
    return "name is required.";
  }
  if (typeof record.category !== "string" || !isItemCategory(record.category)) {
    return "category must be a supported wardrobe category.";
  }
  if (typeof record.color !== "string" || !record.color.trim()) {
    return "color is required.";
  }

  const notes =
    record.notes === undefined || record.notes === null
      ? ""
      : typeof record.notes === "string"
        ? record.notes
        : null;
  if (notes === null) {
    return "notes must be a string.";
  }

  const availabilityRaw = record.availability ?? "available";
  if (typeof availabilityRaw !== "string" || !isAvailabilityStatus(availabilityRaw)) {
    return "availability must be available, in_laundry, or packed_away.";
  }

  return {
    name: record.name.trim(),
    category: record.category,
    color: record.color.trim(),
    notes: notes.trim(),
    availability: availabilityRaw,
  };
}

export async function GET(request: Request) {
  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) {
    return tokenOrResponse;
  }

  const { searchParams } = new URL(request.url);
  const availabilityParam = searchParams.get("availability");
  let availability: AvailabilityStatus | null = null;
  if (availabilityParam !== null && availabilityParam !== "") {
    if (!isAvailabilityStatus(availabilityParam)) {
      return jsonPrivate(
        {
          error: "availability must be available, in_laundry, or packed_away.",
          kind: "validation",
        },
        { status: 422 },
      );
    }
    availability = availabilityParam;
  }

  const result = await backendListWardrobe(tokenOrResponse, availability);
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      return unauthorizedSessionResponse(result.message);
    }
    return jsonPrivate(
      { error: result.message, kind: result.kind },
      { status: result.status === 503 ? 503 : result.status === 422 ? 422 : 502 },
    );
  }

  return jsonPrivate({ items: result.data }, { status: 200 });
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
    return jsonPrivate({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = parseCreatePayload(body);
  if (typeof parsed === "string") {
    return jsonPrivate({ error: parsed, kind: "validation" }, { status: 422 });
  }

  const result = await backendCreateWardrobeItem(tokenOrResponse, parsed);
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      return unauthorizedSessionResponse(result.message);
    }
    return jsonPrivate(
      { error: result.message, kind: result.kind },
      {
        status:
          result.kind === "validation"
            ? 422
            : result.kind === "unavailable"
              ? 503
              : 502,
      },
    );
  }

  return jsonPrivate({ item: result.data }, { status: 201 });
}
