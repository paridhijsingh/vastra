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

import { POST as createEmergencyOutfit } from "@/app/api/outfits/emergency/route";
import { POST as rescueOutfit } from "@/app/api/outfits/rescue/route";
import { DELETE as deleteLook, PATCH as patchLook } from "@/app/api/looks/[lookId]/route";
import { GET as listLooks, POST as createLook } from "@/app/api/looks/route";
import { outfitFromApi } from "@/lib/emergency/form";
import {
  editLookRequest,
  lookFromApi,
  saveLookRequest,
} from "@/lib/looks/form";
import { rescueViewFromApi } from "@/lib/rescue/form";

const EMERGENCY = {
  title: "dinner with friends",
  items: [
    { id: "top-secret", name: "Tank Top", category: "top", color: "Blue", notes: "Everyday", availability: "available" },
    { id: "bottom-secret", name: "Trousers", category: "bottom", color: "Navy", notes: "", availability: "available" },
  ],
  explanation: "Both pieces are available.",
  styling_tips: [],
  limitations: "",
};

const RESCUE = {
  title: "dinner with friends",
  items: [
    { id: "shirt-secret", name: "Linen shirt", category: "top", color: "White", notes: "", availability: "available" },
    { id: "bottom-secret", name: "Trousers", category: "bottom", color: "Navy", notes: "", availability: "available" },
  ],
  explanation: "The linen shirt is available.",
  styling_tips: [],
  limitations: "",
  replaced_item_id: "top-secret",
  replacement_item_id: "shirt-secret",
};

const SAVED = {
  id: "look-1",
  name: "Dinner",
  occasion: "dinner with friends",
  notes: "Mostly standing.",
  contains_removed_items: true,
  removed_item_notice: "This look includes a wardrobe item that was removed.",
  owner_id: "owner-secret",
  items: [
    {
      missing: false,
      id: "top-secret",
      name: "Tank Top",
      category: "top",
      color: "Blue",
      notes: "Everyday",
      availability: "in_laundry",
    },
    { missing: true, id: "gone-secret", name: "Secret kurta", notes: "private-hem" },
    {
      missing: false,
      id: "shoes-secret",
      name: "Sandals",
      category: "shoes",
      color: "Tan",
      notes: "",
      availability: "packed_away",
    },
  ],
  created_at: "2026-10-14T00:00:00Z",
  updated_at: "2026-10-14T00:00:00Z",
};

function sameOrigin(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  cookieState.token = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saving a generated outfit", () => {
  it("saves emergency items in displayed order and rescue items from the replacement outfit", () => {
    const emergency = outfitFromApi(EMERGENCY);
    const rescue = rescueViewFromApi(RESCUE, { "top-secret": "Tank Top" });
    expect(emergency?.itemIds).toEqual(["top-secret", "bottom-secret"]);
    expect(rescue?.itemIds).toEqual(["shirt-secret", "bottom-secret"]);
    const emergencySave = saveLookRequest({
      pending: false,
      name: `  ${emergency?.title}  `,
      occasion: emergency?.title ?? "",
      notes: "  Mostly standing.  ",
      itemIds: emergency?.itemIds ?? [],
    });
    const rescueSave = saveLookRequest({
      pending: false,
      name: rescue?.title ?? "",
      occasion: rescue?.title ?? "",
      notes: "",
      itemIds: rescue?.itemIds ?? [],
    });
    expect(emergencySave).toEqual({
      status: "ready",
      body: {
        name: "dinner with friends",
        occasion: "dinner with friends",
        notes: "Mostly standing.",
        item_ids: ["top-secret", "bottom-secret"],
      },
    });
    expect(rescueSave).toEqual({
      status: "ready",
      body: {
        name: "dinner with friends",
        occasion: "dinner with friends",
        item_ids: ["shirt-secret", "bottom-secret"],
      },
    });
    expect(rescueSave.status === "ready" && rescueSave.body.item_ids).not.toContain("top-secret");
  });

  it("blocks a duplicate save and keeps the entered values when validation fails", () => {
    const draft = { name: "Dinner", occasion: "party", notes: "bring a jacket", itemIds: ["top-secret"] };
    expect(saveLookRequest({ pending: true, ...draft })).toEqual({ status: "blocked" });
    const invalid = saveLookRequest({ pending: false, ...draft, name: "   " });
    expect(invalid.status).toBe("invalid");
    expect(draft.name).toBe("Dinner");
    expect(draft.notes).toBe("bring a jacket");
  });

  it("posts the look once and does not call a generation endpoint", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).not.toContain("/outfits/");
      return Response.json(SAVED, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await createLook(
      sameOrigin("http://localhost:3000/api/looks", "POST", {
        name: " Dinner ",
        occasion: " dinner with friends ",
        notes: "",
        item_ids: ["top-secret", "bottom-secret"],
      }),
    );
    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent).toEqual({
      name: "Dinner",
      occasion: "dinner with friends",
      item_ids: ["top-secret", "bottom-secret"],
    });
    const body = await response.json();
    expect(body.look.name).toBe("Dinner");
    expect(JSON.stringify(body)).not.toContain("owner-secret");
    expect(JSON.stringify(body)).not.toContain("valid-token");
    expect(JSON.stringify(body.look.items)).not.toContain("top-secret");
    expect(JSON.stringify(body.look.items)).not.toContain("Secret kurta");
  });

  it("explains a deleted wardrobe item without dropping the request ids", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async () => Response.json({ detail: "Wardrobe item not found." }, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await createLook(
      sameOrigin("http://localhost:3000/api/looks", "POST", {
        name: "Dinner",
        item_ids: ["top-secret", "gone-secret"],
      }),
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error).toMatch(/removed/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent.item_ids).toEqual(["top-secret", "gone-secret"]);
  });
});

describe("saved look list, detail, edit, and delete", () => {
  it("keeps missing items in place and shows current availability", () => {
    const look = lookFromApi(SAVED);
    expect(look?.items.map((item) => (item.missing ? item.label : [item.name, item.availabilityLabel]))).toEqual([
      ["Tank Top", "In laundry"],
      "Wardrobe item removed",
      ["Sandals", "Packed away"],
    ]);
    expect(look?.removedItemNotice).toMatch(/removed/);
    expect(JSON.stringify(look)).not.toContain("owner-secret");
    expect(JSON.stringify(look?.items)).not.toContain("gone-secret");
    expect(JSON.stringify(look?.items)).not.toContain("Secret kurta");
    expect(JSON.stringify(look?.items)).not.toContain("private-hem");
  });

  it("lists looks from the API without calling generation", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toMatch(/\/looks$/);
      expect(init?.method ?? "GET").toBe("GET");
      return Response.json([SAVED]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await listLooks();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.looks[0].name).toBe("Dinner");
    expect(body.looks.map((look: { id: string }) => look.id)).toEqual(["look-1"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("patches only changed fields, clears optional text, and skips an empty patch", async () => {
    const original = { name: "Dinner", occasion: "party", notes: "bring a jacket" };
    const cleared = editLookRequest({
      pending: false,
      original,
      name: "Dinner",
      occasion: "   ",
      notes: "",
    });
    expect(cleared).toEqual({ status: "ready", body: { occasion: null, notes: null } });
    expect(editLookRequest({ pending: false, original, name: "Dinner", occasion: "party", notes: "bring a jacket" })).toEqual({
      status: "unchanged",
    });
    expect(editLookRequest({ pending: true, original, name: "Evening", occasion: "party", notes: "bring a jacket" })).toEqual({
      status: "blocked",
    });
    expect(original.name).toBe("Dinner");

    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).not.toContain("/outfits/");
      expect(String(url)).not.toContain("/wardrobe");
      return Response.json({ ...SAVED, name: "Evening", occasion: null, notes: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await patchLook(
      sameOrigin("http://localhost:3000/api/looks/look-1", "PATCH", { occasion: null, notes: null }),
      { params: Promise.resolve({ lookId: "look-1" }) },
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ occasion: null, notes: null });
    const empty = await patchLook(sameOrigin("http://localhost:3000/api/looks/look-1", "PATCH", {}), {
      params: Promise.resolve({ lookId: "look-1" }),
    });
    expect(empty.status).toBe(422);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes the look without deleting wardrobe items", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toMatch(/\/looks\/look-1$/);
      expect(String(url)).not.toContain("/wardrobe");
      expect(String(url)).not.toContain("/outfits/");
      expect(init?.method).toBe("DELETE");
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await deleteLook(sameOrigin("http://localhost:3000/api/looks/look-1", "DELETE"), {
      params: Promise.resolve({ lookId: "look-1" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("generation routes stay separate from saving", () => {
  it("does not save while creating an emergency outfit or a rescue revision", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).not.toContain("/looks");
      if (String(url).includes("/rescue")) return Response.json(RESCUE);
      return Response.json(EMERGENCY);
    });
    vi.stubGlobal("fetch", fetchMock);
    const emergency = await createEmergencyOutfit(
      sameOrigin("http://localhost:3000/api/outfits/emergency", "POST", { occasion: "dinner with friends" }),
    );
    const rescue = await rescueOutfit(
      sameOrigin("http://localhost:3000/api/outfits/rescue", "POST", {
        item_ids: ["top-secret", "bottom-secret"],
        replace_item_id: "top-secret",
        occasion: "dinner with friends",
        change_request: "Warmer top",
      }),
    );
    expect(emergency.status).toBe(200);
    expect(rescue.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
