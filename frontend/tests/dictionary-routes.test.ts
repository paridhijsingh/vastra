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

import { GET as getEntry } from "@/app/api/dictionary/[entryId]/route";
import { GET as listDictionary } from "@/app/api/dictionary/route";
import {
  DICTIONARY_FILTER_NOTE,
  DICTIONARY_LOAD_ERROR,
  EMPTY_DICTIONARY_BODY,
  EMPTY_DICTIONARY_TITLE,
  MISSING_ENTRY_BODY,
  MISSING_ENTRY_TITLE,
  NO_MATCH_TITLE,
  dictionaryListHref,
  filtersFromSearchParams,
  hasActiveDictionaryFilters,
} from "@/lib/dictionary/types";

const FIXTURE = {
  id: "kurta",
  term: "Kurta",
  aliases: ["kurta shirt"],
  definition: "A tunic-length top worn by people of any gender.",
  kind: "garment",
  styles: ["Indian", "fusion"],
  style_tags: ["Indian", "South Asian"],
  cultural_context: "Common across South Asia.",
  pairing_suggestions: ["One option is straight trousers."],
  occasions: ["everyday"],
  weather_notes: ["Lighter cotton is often easier in heat."],
  comfort_notes: ["Choose the fit you prefer."],
  guidance_type: "general",
};

beforeEach(() => {
  cookieState.token = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("dictionary filter URLs and empty copy", () => {
  it("omits all-styles and all-types from the page URL", () => {
    expect(dictionaryListHref({ q: "  kurta  ", style: "", kind: "", tag: "" })).toBe(
      "/dictionary?q=kurta",
    );
    expect(
      dictionaryListHref({ q: "", style: "Indian", kind: "garment", tag: "  Yoruba  " }),
    ).toBe("/dictionary?style=Indian&kind=garment&tag=Yoruba");
    expect(dictionaryListHref({ q: " ", style: "", kind: "", tag: "   " })).toBe(
      "/dictionary",
    );
    expect(hasActiveDictionaryFilters({ q: " ", style: "", kind: "", tag: " " })).toBe(
      false,
    );
    expect(hasActiveDictionaryFilters({ q: "", style: "", kind: "", tag: "Yoruba" })).toBe(
      true,
    );
    expect(DICTIONARY_FILTER_NOTE).toBe(
      "Browse broad styles, or filter by a specific cultural or style tag.",
    );
  });

  it("does not map an unsupported cultural style onto Indian", () => {
    const parsed = filtersFromSearchParams({ style: "Yoruba", q: "scarf" });
    expect(parsed.unsupportedStyle).toBe("Yoruba");
    expect(parsed.filters.style).toBe("");
    expect(parsed.filters.style).not.toBe("Indian");
    expect(parsed.filters.tag).toBe("");
    expect(dictionaryListHref(parsed.filters)).toBe("/dictionary?q=scarf");
    const tagged = filtersFromSearchParams({ tag: " Yoruba " });
    expect(tagged.filters.tag).toBe(" Yoruba ");
    expect(tagged.unsupportedStyle).toBeNull();
    expect(dictionaryListHref(tagged.filters)).toBe("/dictionary?tag=Yoruba");
  });

  it("uses the empty, filtered, and missing-entry messages", () => {
    expect(EMPTY_DICTIONARY_TITLE).toBe("No dictionary entries yet.");
    expect(EMPTY_DICTIONARY_BODY).toContain("collection grows");
    expect(NO_MATCH_TITLE).toBe("No matching terms.");
    expect(MISSING_ENTRY_TITLE).toBe("Term not found");
    expect(MISSING_ENTRY_BODY).toContain("does not exist");
    expect(DICTIONARY_LOAD_ERROR).toMatch(/try again/i);
  });
});

describe("GET /api/dictionary", () => {
  it("rejects unauthenticated access", async () => {
    const response = await listDictionary(
      new Request("http://localhost:3000/api/dictionary"),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("returns an empty collection and does not expose the token", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const parsed = new URL(String(url));
      expect(parsed.pathname).toBe("/dictionary");
      expect(parsed.search).toBe("");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer valid-token");
      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await listDictionary(
      new Request("http://localhost:3000/api/dictionary"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entries).toEqual([]);
    expect(JSON.stringify(body)).not.toContain("valid-token");
  });

  it("forwards submitted search, style, and kind filters", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(String(url));
      expect(parsed.searchParams.get("q")).toBe("odhni");
      expect(parsed.searchParams.get("style")).toBe("Indian");
      expect(parsed.searchParams.get("kind")).toBe("garment");
      return Response.json([FIXTURE]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await listDictionary(
      new Request(
        "http://localhost:3000/api/dictionary?q=odhni&style=Indian&kind=garment",
      ),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entries[0].id).toBe("kurta");
    expect(body.entries[0].style_tags).toEqual(["Indian", "South Asian"]);
    expect(JSON.stringify(body)).not.toContain("valid-token");
  });

  it("forwards a cultural tag and omits a blank tag", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(String(url));
      expect(parsed.searchParams.get("tag")).toBe("South Asian");
      expect(parsed.searchParams.get("style")).toBeNull();
      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const tagged = await listDictionary(
      new Request("http://localhost:3000/api/dictionary?tag=%20South%20Asian%20"),
    );
    expect(tagged.status).toBe(200);
    expect(await tagged.json()).toEqual({ entries: [] });

    fetchMock.mockImplementation(async (url: string) => {
      const parsed = new URL(String(url));
      expect(parsed.searchParams.get("tag")).toBeNull();
      return Response.json([]);
    });
    const blank = await listDictionary(
      new Request("http://localhost:3000/api/dictionary?tag=%20%20"),
    );
    expect(blank.status).toBe(200);
    expect(await blank.json()).toEqual({ entries: [] });
  });

  it("rejects an unsupported style filter without calling the backend", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await listDictionary(
      new Request("http://localhost:3000/api/dictionary?style=Yoruba"),
    );
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.kind).toBe("validation");
    expect(JSON.stringify(body)).not.toContain("valid-token");
  });

  it("surfaces a dictionary load error", async () => {
    cookieState.token = "valid-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );

    const response = await listDictionary(
      new Request("http://localhost:3000/api/dictionary?q=kurta"),
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toMatch(/unavailable/i);
  });
});

describe("GET /api/dictionary/[entryId]", () => {
  it("rejects unauthenticated access", async () => {
    const response = await getEntry(new Request("http://localhost:3000/api/dictionary/kurta"), {
      params: Promise.resolve({ entryId: "kurta" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns a missing entry as not found", async () => {
    cookieState.token = "valid-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ detail: "Dictionary entry not found" }, { status: 404 }),
      ),
    );

    const response = await getEntry(new Request("http://localhost:3000/api/dictionary/missing"), {
      params: Promise.resolve({ entryId: "missing" }),
    });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.kind).toBe("not_found");
    expect(body.error).toBe(MISSING_ENTRY_BODY);
    expect(JSON.stringify(body)).not.toContain("valid-token");
  });

  it("returns one fixture entry without the bearer token", async () => {
    cookieState.token = "valid-token";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(FIXTURE)));

    const response = await getEntry(new Request("http://localhost:3000/api/dictionary/kurta"), {
      params: Promise.resolve({ entryId: "kurta" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entry.term).toBe("Kurta");
    expect(body.entry.cultural_context).toContain("South Asia");
    expect(JSON.stringify(body)).not.toContain("valid-token");
  });
});
