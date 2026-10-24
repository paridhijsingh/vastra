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

import { POST as rescueOutfit } from "@/app/api/outfits/rescue/route";
import { MODEL_PROXY_TIMEOUT_MS } from "@/lib/config";
import {
  canSubmitRescue,
  chooseReplacement,
  keepingIds,
  replacementCandidateCount,
  rescueDecision,
  rescueViewFromApi,
  toggleOutfitItem,
  wardrobeGate,
  type AvailableItem,
  type RescueFormState,
  type RescueView,
} from "@/lib/rescue/form";

const TOP: AvailableItem = { id: "top-secret", name: "Tank Top", category: "top", color: "Blue", notes: "Everyday Wear" };
const SHIRT: AvailableItem = { id: "shirt-secret", name: "Linen shirt", category: "top", color: "White", notes: "" };
const BOTTOM: AvailableItem = { id: "bottom-secret", name: "Trousers", category: "bottom", color: "Navy", notes: "" };
const ITEMS = [TOP, SHIRT, BOTTOM];

const RESULT = {
  title: "dinner with friends",
  items: [
    { id: "shirt-secret", name: "Linen shirt", category: "top", color: "White", notes: "", availability: "available" },
    { id: "bottom-secret", name: "Trousers", category: "bottom", color: "Navy", notes: "", availability: "available" },
  ],
  explanation: "The linen shirt is available. Fabric is unknown.",
  styling_tips: [],
  limitations: "",
  replaced_item_id: "top-secret",
  replacement_item_id: "shirt-secret",
};

function form(partial: Partial<RescueFormState> = {}): RescueFormState {
  return {
    selectedIds: [],
    replaceItemId: null,
    occasion: "dinner with friends",
    changeRequest: "The top feels too warm.",
    comfortText: "breathable",
    result: null,
    ...partial,
  };
}

function sameOrigin(body: unknown): Request {
  return new Request("http://localhost:3000/api/outfits/rescue", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  cookieState.token = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("rescue selection", () => {
  it("clears the replacement when that piece is deselected and labels the rest as kept", () => {
    const selected = toggleOutfitItem(toggleOutfitItem(form(), TOP.id), BOTTOM.id);
    const replacing = chooseReplacement(selected, TOP.id);
    expect(keepingIds(replacing.selectedIds, replacing.replaceItemId)).toEqual([BOTTOM.id]);
    const cleared = toggleOutfitItem(replacing, TOP.id);
    expect(cleared.selectedIds).toEqual([BOTTOM.id]);
    expect(cleared.replaceItemId).toBeNull();
    expect(cleared.result).toBeNull();
  });

  it("disables submission when no same-category candidate is outside the outfit", () => {
    const count = replacementCandidateCount(ITEMS, [TOP.id, BOTTOM.id], TOP.id);
    expect(count).toBe(1);
    expect(
      canSubmitRescue({
        gate: wardrobeGate({ loading: false, failed: false, availableCount: 3 }),
        pending: false,
        replaceItemId: TOP.id,
        candidateCount: replacementCandidateCount([TOP, BOTTOM], [TOP.id, BOTTOM.id], TOP.id),
      }),
    ).toBe(false);
    expect(wardrobeGate({ loading: false, failed: true, availableCount: 0 }).status).toBe("error");
    expect(wardrobeGate({ loading: false, failed: false, availableCount: 0 }).status).toBe("empty");
  });

  it("builds the exact request in wardrobe order and blocks a duplicate submit", () => {
    const ready = chooseReplacement(toggleOutfitItem(toggleOutfitItem(form(), BOTTOM.id), TOP.id), TOP.id);
    const decision = rescueDecision({
      pending: false,
      items: ITEMS,
      selectedIds: ready.selectedIds,
      replaceItemId: ready.replaceItemId,
      occasion: "  dinner with friends  ",
      changeRequest: "  The top feels too warm.  ",
      comfortText: "breathable\n",
    });
    expect(decision).toEqual({
      status: "ready",
      body: {
        item_ids: [TOP.id, BOTTOM.id],
        replace_item_id: TOP.id,
        occasion: "dinner with friends",
        change_request: "The top feels too warm.",
        comfort_needs: ["breathable"],
      },
    });
    const pending = rescueDecision({
      pending: true,
      items: ITEMS,
      selectedIds: ready.selectedIds,
      replaceItemId: ready.replaceItemId,
      occasion: ready.occasion,
      changeRequest: ready.changeRequest,
      comfortText: ready.comfortText,
    });
    expect(pending).toEqual({ status: "blocked" });
    expect(ready.occasion).toBe("dinner with friends");
    expect(ready.changeRequest).toBe("The top feels too warm.");
  });

  it("keeps entered values when validation fails and clears a stale result when the selection changes", () => {
    const previous = { title: "old", headline: "old", cards: [], itemIds: [], explanation: "old", limitations: "", styling_tips: [] } satisfies RescueView;
    const saved = form({ selectedIds: [TOP.id], replaceItemId: TOP.id, result: previous, changeRequest: "" });
    const decision = rescueDecision({
      pending: false,
      items: ITEMS,
      selectedIds: saved.selectedIds,
      replaceItemId: saved.replaceItemId,
      occasion: saved.occasion,
      changeRequest: saved.changeRequest,
      comfortText: saved.comfortText,
    });
    expect(decision.status).toBe("invalid");
    expect(saved.occasion).toBe("dinner with friends");
    expect(saved.selectedIds).toEqual([TOP.id]);
    expect(saved.result).toBe(previous);
    expect(toggleOutfitItem(saved, SHIRT.id).result).toBeNull();
  });

  it("labels the replacement and the locked pieces without showing raw ids", () => {
    const view = rescueViewFromApi(RESULT, { "top-secret": "Tank Top" });
    expect(view?.headline).toBe("Replaced Tank Top with Linen shirt");
    expect(view?.cards.map((card) => [card.name, card.role])).toEqual([
      ["Linen shirt", "Replaced"],
      ["Trousers", "Kept"],
    ]);
    expect(view?.itemIds).toEqual(["shirt-secret", "bottom-secret"]);
    expect(JSON.stringify(view?.cards)).not.toContain("top-secret");
    expect(JSON.stringify(view?.cards)).not.toContain("shirt-secret");
    expect(JSON.stringify(view?.cards)).not.toContain("bottom-secret");
  });
});

describe("POST /api/outfits/rescue", () => {
  it("forwards the exact payload once and does not echo the token", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async () => Response.json(RESULT));
    vi.stubGlobal("fetch", fetchMock);
    const response = await rescueOutfit(
      sameOrigin({
        item_ids: [TOP.id, BOTTOM.id],
        replace_item_id: TOP.id,
        occasion: "dinner with friends",
        change_request: "The top feels too warm.",
        comfort_needs: ["breathable"],
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent).toEqual({
      item_ids: [TOP.id, BOTTOM.id],
      replace_item_id: TOP.id,
      occasion: "dinner with friends",
      change_request: "The top feels too warm.",
      comfort_needs: ["breathable"],
    });
    expect(JSON.stringify(await response.json())).not.toContain("valid-token");
  });

  it("explains a 409 without calling the model again and rejects a cross-origin submit", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async () => Response.json({ detail: "No other available item" }, { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    const conflict = await rescueOutfit(
      sameOrigin({
        item_ids: [TOP.id],
        replace_item_id: TOP.id,
        occasion: "dinner",
        change_request: "Warmer top",
      }),
    );
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error).toMatch(/may have changed/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const forbidden = await rescueOutfit(
      new Request("http://localhost:3000/api/outfits/rescue", {
        method: "POST",
        headers: { host: "localhost:3000", origin: "https://evil.example", "content-type": "application/json" },
        body: JSON.stringify({
          item_ids: [TOP.id],
          replace_item_id: TOP.id,
          occasion: "dinner",
          change_request: "Warmer top",
        }),
      }),
    );
    expect(forbidden.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed backend outfit without leaking internals", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async () =>
      Response.json({ title: "dinner", shopping_url: "https://shop.example/secret-coat" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await rescueOutfit(
      sameOrigin({
        item_ids: [TOP.id],
        replace_item_id: TOP.id,
        occasion: "dinner",
        change_request: "Warmer top",
      }),
    );
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe("The outfit suggestion could not be used. Please try again.");
    expect(JSON.stringify(body)).not.toContain("shop.example");
    expect(JSON.stringify(body)).not.toContain("secret-coat");
  });

  it("maps a fetch abort to a timeout without leaking internals", async () => {
    cookieState.token = "valid-token";
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await rescueOutfit(
      sameOrigin({
        item_ids: [TOP.id],
        replace_item_id: TOP.id,
        occasion: "dinner",
        change_request: "Warmer top",
      }),
    );
    expect(timeoutSpy).toHaveBeenCalledWith(MODEL_PROXY_TIMEOUT_MS);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeDefined();
    expect(response.status).toBe(504);
    const body = await response.json();
    expect(body.error).toBe("The outfit request timed out. Please try again.");
    expect(body.kind).toBe("timeout");
    expect(JSON.stringify(body)).not.toContain("The operation timed out");
  });
});
