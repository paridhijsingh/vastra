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
import {
  canGenerateOutfit,
  emergencyFitBody,
  generationRequest,
  outfitFromApi,
  wardrobeGate,
} from "@/lib/emergency/form";

const OUTFIT = {
  title: "dinner with friends",
  items: [
    {
      id: "item-secret-id",
      name: "Tank Top",
      category: "top",
      color: "Blue",
      notes: "Everyday Wear",
      availability: "available",
    },
  ],
  explanation: "This top is available. Fabric is unknown.",
  styling_tips: [],
  limitations: "This outfit is incomplete: a bottom and shoes are missing.",
};

function sameOrigin(body: unknown): Request {
  return new Request("http://localhost:3000/api/outfits/emergency", {
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

describe("emergency fit form", () => {
  it("builds a request from one comfort need per line and omits a blank vibe", () => {
    const body = emergencyFitBody({
      occasion: "  dinner with friends  ",
      vibe: "   ",
      comfortText: "breathable\n\nsoft",
    });
    expect(body).toEqual({
      occasion: "dinner with friends",
      comfort_needs: ["breathable", "soft"],
    });
    expect(body).not.toHaveProperty("owner_id");
  });

  it("blocks a second submit while one is pending and keeps the entered values", () => {
    const values = {
      pending: true,
      occasion: "dinner with friends",
      vibe: "relaxed",
      comfortText: "breathable",
    };
    expect(generationRequest(values)).toEqual({ status: "blocked" });
    expect(values.occasion).toBe("dinner with friends");
    expect(values.comfortText).toBe("breathable");
  });

  it("keeps field errors without starting a request", () => {
    const decision = generationRequest({
      pending: false,
      occasion: " ",
      vibe: "",
      comfortText: "   ",
    });
    expect(decision.status).toBe("invalid");
    if (decision.status === "invalid") {
      expect(decision.errors.occasion).toBe("Occasion is required.");
      expect(decision.errors.comfort_needs).toBe("Each comfort need must not be blank.");
    }
  });

  it("shows the outfit fields and drops raw item ids", () => {
    const view = outfitFromApi(OUTFIT);
    expect(view?.title).toBe("dinner with friends");
    expect(view?.items).toEqual([
      {
        name: "Tank Top",
        category: "top",
        color: "Blue",
        notes: "Everyday Wear",
      },
    ]);
    expect(view?.explanation).toBe("This top is available. Fabric is unknown.");
    expect(view?.styling_tips).toEqual([]);
    expect(view?.limitations).toContain("a bottom and shoes are missing");
    expect(JSON.stringify(view)).not.toContain("item-secret-id");
    expect(JSON.stringify(view)).not.toContain("<");
  });

  it("hides empty styling tips and keeps limitations text as text", () => {
    const view = outfitFromApi({
      ...OUTFIT,
      styling_tips: [],
      explanation: "Wear <b>the tank</b>",
    });
    expect(view?.styling_tips).toEqual([]);
    expect(view?.explanation).toBe("Wear <b>the tank</b>");
  });

  it("disables generation when no clothes are available and does not treat a load error as empty", () => {
    expect(canGenerateOutfit(wardrobeGate({ loading: false, failed: false, availableCount: 0 }), false)).toBe(
      false,
    );
    expect(wardrobeGate({ loading: false, failed: true, availableCount: 0 }).status).toBe("error");
    expect(canGenerateOutfit(wardrobeGate({ loading: false, failed: true, availableCount: 0 }), false)).toBe(
      false,
    );
    expect(canGenerateOutfit(wardrobeGate({ loading: false, failed: false, availableCount: 1 }), false)).toBe(
      true,
    );
    expect(canGenerateOutfit(wardrobeGate({ loading: false, failed: false, availableCount: 1 }), true)).toBe(
      false,
    );
  });
});

describe("POST /api/outfits/emergency", () => {
  it("returns the outfit from one backend call", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async () => Response.json(OUTFIT));
    vi.stubGlobal("fetch", fetchMock);
    const response = await createEmergencyOutfit(
      sameOrigin({
        occasion: "dinner with friends",
        vibe: "relaxed",
        comfort_needs: ["breathable"],
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const body = await response.json();
    expect(body.outfit.items[0].name).toBe("Tank Top");
    expect(body.outfit.items[0].notes).toBe("Everyday Wear");
    expect(JSON.stringify(body)).not.toContain("item-secret-id");
    expect(JSON.stringify(body)).not.toContain("valid-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent).toEqual({
      occasion: "dinner with friends",
      vibe: "relaxed",
      comfort_needs: ["breathable"],
    });
  });

  it("explains a 409 and preserves provider errors for a later click", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async () =>
      Response.json({ detail: "No available wardrobe items." }, { status: 409 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const conflict = await createEmergencyOutfit(sameOrigin({ occasion: "dinner" }));
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error).toMatch(/available wardrobe items/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(Response.json({ detail: "nope" }, { status: 502 }));
    const failed = await createEmergencyOutfit(sameOrigin({ occasion: "dinner" }));
    expect(failed.status).toBe(502);
    expect((await failed.json()).error).toMatch(/could not be used/i);

    fetchMock.mockResolvedValueOnce(Response.json({ detail: "down" }, { status: 503 }));
    const unavailable = await createEmergencyOutfit(sameOrigin({ occasion: "dinner" }));
    expect(unavailable.status).toBe(503);

    fetchMock.mockResolvedValueOnce(Response.json({ detail: "slow" }, { status: 504 }));
    const timedOut = await createEmergencyOutfit(sameOrigin({ occasion: "dinner" }));
    expect(timedOut.status).toBe(504);
    expect((await timedOut.json()).error).toMatch(/timed out/i);
  });

  it("returns field errors for invalid input without calling the model API", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await createEmergencyOutfit(sameOrigin({ occasion: "   ", owner_id: "other" }));
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain("other");
  });

  it("rejects a cross-origin submit", async () => {
    cookieState.token = "valid-token";
    const response = await createEmergencyOutfit(
      new Request("http://localhost:3000/api/outfits/emergency", {
        method: "POST",
        headers: { host: "localhost:3000", origin: "https://evil.example", "content-type": "application/json" },
        body: JSON.stringify({ occasion: "dinner" }),
      }),
    );
    expect(response.status).toBe(403);
  });
});
