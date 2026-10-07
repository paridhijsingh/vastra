import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieState: { token: string | undefined } = { token: undefined };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === "vastra_access_token" && cookieState.token) {
        return { name, value: cookieState.token };
      }
      return undefined;
    },
  }),
}));

import {
  GET as listWardrobe,
  POST as createWardrobe,
} from "@/app/api/wardrobe/route";
import {
  DELETE as deleteWardrobeItem,
  PATCH as patchWardrobeItem,
} from "@/app/api/wardrobe/[itemId]/route";
import { AUTH_COOKIE_NAME } from "@/lib/auth/cookies";
import { diffWardrobeUpdate } from "@/lib/wardrobe/types";

const ITEM_A = {
  id: "item-a",
  owner_id: "user-1",
  name: "Navy kurta",
  category: "top",
  color: "navy",
  notes: "cotton",
  availability: "available",
};

const ITEM_B = {
  id: "item-b",
  owner_id: "user-1",
  name: "Navy kurta",
  category: "top",
  color: "navy",
  notes: "silk",
  availability: "in_laundry",
};

function sameOriginHeaders(): HeadersInit {
  return {
    host: "localhost:3000",
    origin: "http://localhost:3000",
    "content-type": "application/json",
  };
}

beforeEach(() => {
  cookieState.token = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("diffWardrobeUpdate", () => {
  it("includes only changed fields and can clear notes", () => {
    const patch = diffWardrobeUpdate(ITEM_A, {
      name: "Navy kurta",
      category: "top",
      color: "navy",
      notes: "",
      availability: "packed_away",
    });
    expect(patch).toEqual({
      notes: "",
      availability: "packed_away",
    });
  });
});

describe("GET /api/wardrobe", () => {
  it("rejects unauthenticated access", async () => {
    const response = await listWardrobe(
      new Request("http://localhost:3000/api/wardrobe"),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("lists items and forwards the availability filter", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toContain("availability=available");
      return Response.json([ITEM_A]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await listWardrobe(
      new Request("http://localhost:3000/api/wardrobe?availability=available"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe("item-a");
    expect(JSON.stringify(body)).not.toContain("valid-token");
  });

  it("keeps duplicate-name items distinct by id", async () => {
    cookieState.token = "valid-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json([ITEM_A, ITEM_B])),
    );

    const response = await listWardrobe(
      new Request("http://localhost:3000/api/wardrobe"),
    );
    const body = await response.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].name).toBe(body.items[1].name);
    expect(body.items[0].id).not.toBe(body.items[1].id);
  });

  it("rejects invalid availability filters", async () => {
    cookieState.token = "valid-token";
    const response = await listWardrobe(
      new Request("http://localhost:3000/api/wardrobe?availability=missing"),
    );
    expect(response.status).toBe(422);
  });
});

describe("POST /api/wardrobe", () => {
  it("rejects cross-origin creates", async () => {
    cookieState.token = "valid-token";
    const response = await createWardrobe(
      new Request("http://localhost:3000/api/wardrobe", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Coat",
          category: "outerwear",
          color: "black",
          notes: "",
          availability: "available",
        }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("creates an item without accepting owner_id", async () => {
    cookieState.token = "valid-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
        expect(sent).not.toHaveProperty("owner_id");
        return Response.json(
          { ...ITEM_A, name: "Coat", category: "outerwear" },
          { status: 201 },
        );
      }),
    );

    const response = await createWardrobe(
      new Request("http://localhost:3000/api/wardrobe", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: JSON.stringify({
          name: "Coat",
          category: "outerwear",
          color: "black",
          notes: "",
          availability: "available",
          owner_id: "spoof",
        }),
      }),
    );
    expect(response.status).toBe(422);
  });

  it("creates a valid item", async () => {
    cookieState.token = "valid-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(ITEM_A, { status: 201 })),
    );

    const response = await createWardrobe(
      new Request("http://localhost:3000/api/wardrobe", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: JSON.stringify({
          name: "Navy kurta",
          category: "top",
          color: "navy",
          notes: "cotton",
          availability: "available",
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.item.id).toBe("item-a");
  });
});

describe("PATCH /api/wardrobe/[itemId]", () => {
  it("patches only provided fields and can clear notes", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe("PATCH");
      expect(String(_url)).toContain("/wardrobe/item-a");
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(sent).toEqual({ notes: "", availability: "packed_away" });
      return Response.json({
        ...ITEM_A,
        notes: "",
        availability: "packed_away",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await patchWardrobeItem(
      new Request("http://localhost:3000/api/wardrobe/item-a", {
        method: "PATCH",
        headers: sameOriginHeaders(),
        body: JSON.stringify({ notes: "", availability: "packed_away" }),
      }),
      { params: Promise.resolve({ itemId: "item-a" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.item.notes).toBe("");
    expect(body.item.availability).toBe("packed_away");
  });

  it("returns 404 when the item is missing", async () => {
    cookieState.token = "valid-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ detail: "Wardrobe item not found" }, { status: 404 }),
      ),
    );

    const response = await patchWardrobeItem(
      new Request("http://localhost:3000/api/wardrobe/missing", {
        method: "PATCH",
        headers: sameOriginHeaders(),
        body: JSON.stringify({ color: "red" }),
      }),
      { params: Promise.resolve({ itemId: "missing" }) },
    );
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/wardrobe/[itemId]", () => {
  it("rejects unauthenticated deletes", async () => {
    const response = await deleteWardrobeItem(
      new Request("http://localhost:3000/api/wardrobe/item-a", {
        method: "DELETE",
        headers: sameOriginHeaders(),
      }),
      { params: Promise.resolve({ itemId: "item-a" }) },
    );
    expect(response.status).toBe(401);
  });

  it("deletes an item and clears no token in the body", async () => {
    cookieState.token = "valid-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );

    const response = await deleteWardrobeItem(
      new Request("http://localhost:3000/api/wardrobe/item-a", {
        method: "DELETE",
        headers: sameOriginHeaders(),
      }),
      { params: Promise.resolve({ itemId: "item-a" }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(JSON.stringify(body)).not.toContain("valid-token");
    expect(response.cookies.get(AUTH_COOKIE_NAME)).toBeUndefined();
  });

  it("rejects cross-origin deletes", async () => {
    cookieState.token = "valid-token";
    const response = await deleteWardrobeItem(
      new Request("http://localhost:3000/api/wardrobe/item-a", {
        method: "DELETE",
        headers: {
          host: "localhost:3000",
          origin: "https://evil.example",
        },
      }),
      { params: Promise.resolve({ itemId: "item-a" }) },
    );
    expect(response.status).toBe(403);
  });
});
