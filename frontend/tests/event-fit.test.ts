import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as createEmergencyOutfit } from "@/app/api/outfits/emergency/route";
import { PATCH as patchEvent } from "@/app/api/events/[eventId]/route";
import {
  emergencyFitEventPath,
  emergencyFitFields,
  eventFitContext,
  runAttachLook,
} from "@/lib/emergency/event-fit";
import { prepareEmergencyFit } from "@/lib/emergency/event-fit-server";
import { emergencyFitBody, renderedOutfitFromProxy } from "@/lib/emergency/form";
import { saveLookRequest } from "@/lib/looks/form";

const cookieState: { token: string | undefined } = { token: "valid-token" };

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

const API_EVENT = {
  id: "event-1",
  owner_id: "owner-secret",
  name: "Dinner",
  event_date: "2026-11-02",
  occasion: "dinner with friends",
  notes: "Mostly standing.",
  comfort_needs: ["breathable", "soft"],
  look_id: null,
  look_name: null,
  created_at: "2026-10-15T00:00:00Z",
  updated_at: "2026-10-15T00:00:00Z",
};

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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("event fit prefill", () => {
  it("prefills occasion and comfort needs and leaves vibe blank", () => {
    const event = eventFitContext({
      id: API_EVENT.id,
      name: API_EVENT.name,
      occasion: API_EVENT.occasion,
      comfortNeeds: API_EVENT.comfort_needs,
      lookId: null,
    });
    const fields = emergencyFitFields(event);
    expect(fields).toEqual({
      occasion: "dinner with friends",
      vibe: "",
      comfortText: "breathable\nsoft",
    });
    const body = emergencyFitBody(fields);
    expect(body).toEqual({
      occasion: "dinner with friends",
      comfort_needs: ["breathable", "soft"],
    });
    expect(body).not.toHaveProperty("event_id");
    expect(body).not.toHaveProperty("notes");
    expect(body).not.toHaveProperty("event_date");
    expect(JSON.stringify(event)).not.toContain("Mostly standing.");
    expect(emergencyFitEventPath(event.id)).toBe("/emergency-fit?event=event-1");
    expect(emergencyFitEventPath(event.id)).not.toContain("Dinner");
    expect(emergencyFitEventPath(event.id)).not.toContain("standing");
  });

  it("falls back to the event name when occasion is blank", () => {
    const event = eventFitContext({
      id: "event-1",
      name: "Dinner",
      occasion: "   ",
      comfortNeeds: [],
      lookId: null,
    });
    expect(emergencyFitFields(event)).toEqual({ occasion: "Dinner", vibe: "", comfortText: "" });
  });

  it("starts Emergency Fit blank when no event is supplied", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const loaded = await prepareEmergencyFit("valid-token", undefined);
    expect(loaded).toEqual({ status: "plain" });
    expect(emergencyFitFields(null)).toEqual({ occasion: "", vibe: "", comfortText: "" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("loading an event for Emergency Fit", () => {
  it("loads the event and does not call the model", async () => {
    const fetchMock = vi.fn(async () => Response.json(API_EVENT));
    vi.stubGlobal("fetch", fetchMock);
    const loaded = await prepareEmergencyFit("valid-token", "event-1");
    expect(loaded.status).toBe("ready");
    if (loaded.status === "ready") {
      expect(loaded.event.occasion).toBe("dinner with friends");
      expect(loaded.event.comfortText).toBe("breathable\nsoft");
      expect(loaded.event.hasLook).toBe(false);
      expect(JSON.stringify(loaded.event)).not.toContain("owner-secret");
      expect(JSON.stringify(loaded.event)).not.toContain("Mostly standing.");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/events/event-1");
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("/outfits/");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("GET");
  });

  it("uses the same not-found result for an unknown or foreign event", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ detail: "Other person's private dinner" }, { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const unknown = await prepareEmergencyFit("valid-token", "missing-event");
    const foreign = await prepareEmergencyFit("valid-token", "foreign-event");
    expect(unknown).toEqual({ status: "not_found" });
    expect(foreign).toEqual({ status: "not_found" });
    expect(JSON.stringify(unknown)).not.toContain("private dinner");
    expect(JSON.stringify(foreign)).not.toContain("private dinner");
  });
});

describe("saving and attaching a look", () => {
  it("renders a successful outfit and can save a look without changing the event", async () => {
    cookieState.token = "valid-token";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(OUTFIT)));
    const response = await createEmergencyOutfit(
      new Request("http://localhost:3000/api/outfits/emergency", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ occasion: "dinner with friends", comfort_needs: ["breathable"] }),
      }),
    );
    const view = renderedOutfitFromProxy(await response.json());
    const save = saveLookRequest({
      pending: false,
      name: view?.title ?? "",
      occasion: view?.title ?? "",
      notes: "",
      itemIds: view?.itemIds ?? [],
    });
    expect(save.status).toBe("ready");
    const eventCalls = vi.fn();
    const saved = await runAttachLook({
      pending: true,
      savedLookId: "look-1",
      hasLook: false,
      confirmed: false,
      fetchEvent: eventCalls,
      patchEvent: eventCalls,
    });
    expect(saved).toEqual({ status: "blocked", savedLookId: "look-1" });
    expect(eventCalls).not.toHaveBeenCalled();
  });

  it("attaches only the look id and asks before replacing a look", async () => {
    const patch = vi.fn(async () => ({ status: 200 }));
    const first = await runAttachLook({
      pending: false,
      savedLookId: "look-new",
      hasLook: true,
      confirmed: false,
      fetchEvent: async () => ({ status: 200, lookId: "look-old" }),
      patchEvent: patch,
    });
    expect(first).toEqual({ status: "confirm", savedLookId: "look-new" });
    expect(patch).not.toHaveBeenCalled();

    const second = await runAttachLook({
      pending: false,
      savedLookId: "look-new",
      hasLook: true,
      confirmed: true,
      fetchEvent: async () => ({ status: 200, lookId: "look-old" }),
      patchEvent: patch,
    });
    expect(second).toEqual({ status: "attached", savedLookId: "look-new" });
    expect(patch).toHaveBeenCalledWith({ look_id: "look-new" });
  });

  it("keeps the saved look when attachment fails or the event was deleted", async () => {
    const failed = await runAttachLook({
      pending: false,
      savedLookId: "look-1",
      hasLook: false,
      confirmed: true,
      fetchEvent: async () => ({ status: 200, lookId: null }),
      patchEvent: async () => ({ status: 503 }),
    });
    expect(failed).toEqual({ status: "failed", savedLookId: "look-1" });

    const retry = vi.fn(async (body: { look_id: string }) => {
      expect(body).toEqual({ look_id: "look-1" });
      return { status: 200 };
    });
    const again = await runAttachLook({
      pending: false,
      savedLookId: failed.savedLookId,
      hasLook: false,
      confirmed: true,
      fetchEvent: async () => ({ status: 200, lookId: null }),
      patchEvent: retry,
    });
    expect(again).toEqual({ status: "attached", savedLookId: "look-1" });

    const deleted = await runAttachLook({
      pending: false,
      savedLookId: "look-1",
      hasLook: false,
      confirmed: true,
      fetchEvent: async () => ({ status: 200, lookId: null }),
      patchEvent: async () => ({ status: 404 }),
    });
    expect(deleted).toEqual({ status: "missing", savedLookId: "look-1" });
  });

  it("forwards an attachment as a look id patch", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).not.toContain("/outfits/");
      return Response.json({ ...API_EVENT, look_id: "look-1", look_name: "Dinner" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await patchEvent(
      new Request("http://localhost:3000/api/events/event-1", {
        method: "PATCH",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ look_id: "look-1" }),
      }),
      { params: Promise.resolve({ eventId: "event-1" }) },
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ look_id: "look-1" });
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).not.toContain("Mostly standing.");
  });
});
