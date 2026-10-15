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

import { PATCH as patchEvent } from "@/app/api/events/[eventId]/route";
import { GET as listEvents, POST as createEvent } from "@/app/api/events/route";
import {
  displayCalendarDate,
  editEventRequest,
  eventFromApi,
  eventsFromApi,
  saveEventRequest,
  type EventView,
} from "@/lib/events/form";

const API_EVENT = {
  id: "event-1",
  owner_id: "owner-secret",
  name: "Dinner",
  event_date: "2026-11-02",
  occasion: "dinner with friends",
  notes: "Mostly standing.",
  comfort_needs: ["breathable"],
  look_id: "look-secret",
  look_name: "Evening wear",
  created_at: "2026-10-15T00:00:00Z",
  updated_at: "2026-10-15T00:00:00Z",
};

function view(partial: Partial<EventView> = {}): EventView {
  return {
    id: "event-1",
    name: "Dinner",
    eventDate: "2026-11-02",
    occasion: "party",
    notes: "standing",
    comfortNeeds: ["breathable"],
    lookId: "look-secret",
    lookName: "Evening wear",
    ...partial,
  };
}

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

describe("event response contract", () => {
  it("keeps the calendar date and drops owner and wardrobe details", () => {
    const event = eventFromApi(API_EVENT);
    expect(event?.eventDate).toBe("2026-11-02");
    expect(displayCalendarDate(event?.eventDate ?? "")).toBe("November 2, 2026");
    expect(JSON.stringify(event)).not.toContain("owner-secret");
    expect(event).not.toHaveProperty("color");
    const detached = eventFromApi({ ...API_EVENT, look_id: null, look_name: null });
    expect(detached?.lookId).toBeNull();
    expect(detached?.lookName).toBeNull();
    expect(detached?.name).toBe("Dinner");
  });

  it("preserves the API date order", () => {
    const events = eventsFromApi([
      { ...API_EVENT, id: "sooner", event_date: "2026-11-02" },
      { ...API_EVENT, id: "later", name: "Reception", event_date: "2026-12-01", look_id: null, look_name: null },
    ]);
    expect(events?.map((event) => event.eventDate)).toEqual(["2026-11-02", "2026-12-01"]);
  });
});

describe("event create and edit payloads", () => {
  it("builds a create body and blocks a duplicate submit", () => {
    const draft = {
      name: "  Dinner  ",
      eventDate: "2026-11-02",
      occasion: "  dinner with friends  ",
      notes: "",
      comfortText: "breathable\n",
      lookId: "",
    };
    expect(saveEventRequest({ pending: false, ...draft })).toEqual({
      status: "ready",
      body: {
        name: "Dinner",
        event_date: "2026-11-02",
        occasion: "dinner with friends",
        comfort_needs: ["breathable"],
      },
    });
    expect(saveEventRequest({ pending: true, ...draft, name: "Dinner" })).toEqual({ status: "blocked" });
    const invalid = saveEventRequest({ pending: false, ...draft, name: "  " });
    expect(invalid.status).toBe("invalid");
    expect(draft.name).toBe("  Dinner  ");
  });

  it("patches only changed fields, clears optional text, and detaches a look", () => {
    const original = view();
    expect(
      editEventRequest({
        pending: false,
        original,
        name: "Dinner",
        eventDate: "2026-11-02",
        occasion: "   ",
        notes: "",
        comfortText: "",
        lookId: "",
      }),
    ).toEqual({
      status: "ready",
      body: { occasion: null, notes: null, comfort_needs: [], look_id: null },
    });
    expect(
      editEventRequest({
        pending: false,
        original,
        name: "Dinner",
        eventDate: "2026-11-02",
        occasion: "party",
        notes: "standing",
        comfortText: "breathable",
        lookId: "look-secret",
      }),
    ).toEqual({ status: "unchanged" });
    expect(original.occasion).toBe("party");
    expect(original.lookId).toBe("look-secret");
  });

  it("forwards the create payload once and does not call generation", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).not.toContain("/outfits/");
      return Response.json(API_EVENT, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await createEvent(
      sameOrigin("http://localhost:3000/api/events", "POST", {
        name: " Dinner ",
        event_date: "2026-11-02",
        occasion: " dinner with friends ",
        notes: "",
        comfort_needs: ["breathable"],
      }),
    );
    expect(response.status).toBe(201);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      name: "Dinner",
      event_date: "2026-11-02",
      occasion: "dinner with friends",
      comfort_needs: ["breathable"],
    });
    const body = await response.json();
    expect(body.event.eventDate).toBe("2026-11-02");
    expect(displayCalendarDate(body.event.eventDate)).toBe("November 2, 2026");
    expect(JSON.stringify(body)).not.toContain("owner-secret");
    expect(JSON.stringify(body)).not.toContain("valid-token");
  });

  it("lists events in the returned order and detaches a look without an empty patch", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") {
        expect(String(url)).toMatch(/\/events$/);
        return Response.json([
          API_EVENT,
          { ...API_EVENT, id: "event-2", event_date: "2026-12-01", look_id: null, look_name: null },
        ]);
      }
      expect(String(url)).not.toContain("/outfits/");
      expect(String(url)).not.toContain("/looks");
      return Response.json({ ...API_EVENT, look_id: null, look_name: null, occasion: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    const listed = await listEvents();
    expect((await listed.json()).events.map((event: { eventDate: string }) => event.eventDate)).toEqual([
      "2026-11-02",
      "2026-12-01",
    ]);
    const response = await patchEvent(
      sameOrigin("http://localhost:3000/api/events/event-1", "PATCH", { occasion: null, look_id: null }),
      { params: Promise.resolve({ eventId: "event-1" }) },
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ occasion: null, look_id: null });
    const empty = await patchEvent(sameOrigin("http://localhost:3000/api/events/event-1", "PATCH", {}), {
      params: Promise.resolve({ eventId: "event-1" }),
    });
    expect(empty.status).toBe(422);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
