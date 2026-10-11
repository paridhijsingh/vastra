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
  DELETE as deleteEntry,
  GET as getEntry,
  PATCH as patchEntry,
} from "@/app/api/dictionary/[entryId]/route";
import { GET as listDictionary, POST as createEntry } from "@/app/api/dictionary/route";
import {
  canManageDictionaryEntry,
  entryToForm,
  submitDictionaryForm,
} from "@/lib/dictionary/form";
import {
  DICTIONARY_FILTER_NOTE,
  DICTIONARY_LOAD_ERROR,
  DICTIONARY_PRIVACY_NOTE,
  EMPTY_DICTIONARY_BODY,
  EMPTY_DICTIONARY_TITLE,
  MISSING_ENTRY_BODY,
  MISSING_ENTRY_TITLE,
  NO_DICTIONARY_CHANGES_MESSAGE,
  NO_MATCH_TITLE,
  TERM_ADDED_MESSAGE,
  TERM_DELETED_MESSAGE,
  dictionaryListHref,
  filtersFromSearchParams,
  hasActiveDictionaryFilters,
  parseDictionaryEntry,
} from "@/lib/dictionary/types";

const FIXTURE = {
  id: "kurta",
  origin: "shared",
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
    expect(body.entry.origin).toBe("shared");
    expect(body.entry.cultural_context).toContain("South Asia");
    expect(JSON.stringify(body)).not.toContain("valid-token");
  });
});

function sameOriginHeaders(): HeadersInit {
  return {
    host: "localhost:3000",
    origin: "http://localhost:3000",
    "content-type": "application/json",
  };
}

const PERSONAL = {
  ...FIXTURE,
  id: "personal-11111111-1111-4111-8111-111111111111",
  origin: "personal",
  term: "Agbada",
  aliases: ["agbada robe"],
  style_tags: ["Yoruba", "West African"],
  cultural_context: "Worn in parts of West Africa.",
  styles: ["fusion"],
};

describe("dictionary entry management", () => {
  it("keeps failed values, clears lists, and ignores id prefixes", () => {
    expect(DICTIONARY_PRIVACY_NOTE).toBe("Terms you add are private to your account.");
    expect(TERM_ADDED_MESSAGE).toBe("Term added to your dictionary");
    expect(TERM_DELETED_MESSAGE).toBe("Term deleted.");
    expect(NO_DICTIONARY_CHANGES_MESSAGE).toBe("No changes to save");

    const parsed = parseDictionaryEntry(PERSONAL);
    expect(parsed).not.toBeNull();
    const values = entryToForm(parsed!);
    const failed = { ...values, term: "   ", definition: values.definition };
    const before = structuredClone(failed);
    const invalid = submitDictionaryForm(failed, parsed);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.fields.term).toMatch(/required/i);
    expect(failed).toEqual(before);

    const unchanged = submitDictionaryForm(values, parsed);
    expect(unchanged.ok && unchanged.mode === "edit" && unchanged.patch).toBeNull();

    const cleared = submitDictionaryForm(
      { ...values, aliases: "", culturalContext: "" },
      parsed,
    );
    expect(cleared.ok && cleared.mode === "edit" ? cleared.patch : null).toEqual({
      aliases: [],
      cultural_context: null,
    });

    expect(canManageDictionaryEntry({ origin: "personal" })).toBe(true);
    expect(canManageDictionaryEntry({ origin: "shared" })).toBe(false);
    expect(
      canManageDictionaryEntry(
        parseDictionaryEntry({ ...PERSONAL, id: "personal-abc", origin: "shared" })!,
      ),
    ).toBe(false);
    expect(canManageDictionaryEntry(parseDictionaryEntry({ ...PERSONAL, origin: undefined })!)).toBe(
      false,
    );
    expect(canManageDictionaryEntry({ origin: "personal" })).toBe(true);
  });

  it("creates a personal entry without client identity fields", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(sent.guidance_type).toBe("general");
      expect(sent).not.toHaveProperty("id");
      expect(sent).not.toHaveProperty("owner_id");
      expect(sent).not.toHaveProperty("origin");
      expect(sent.term).toBe("Agbada");
      return Response.json(PERSONAL, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await createEntry(
      new Request("http://localhost:3000/api/dictionary", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: JSON.stringify({
          term: " Agbada ",
          definition: PERSONAL.definition,
          kind: "garment",
          styles: ["fusion"],
          style_tags: ["Yoruba"],
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.entry.origin).toBe("personal");
    expect(body.entry.id.startsWith("personal-")).toBe(true);
    expect(JSON.stringify(body)).not.toContain("valid-token");
    expect(JSON.stringify(body)).not.toContain("owner_id");
  });

  it("rejects create attempts that set ownership and preserves a validation error", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await createEntry(
      new Request("http://localhost:3000/api/dictionary", {
        method: "POST",
        headers: sameOriginHeaders(),
        body: JSON.stringify({
          term: "Agbada",
          definition: "A robe.",
          kind: "garment",
          owner_id: "spoof",
          origin: "shared",
          id: "kurta",
        }),
      }),
    );
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.kind).toBe("validation");
  });

  it("patches only changed fields and can clear a list and cultural context", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe("PATCH");
      expect(JSON.parse(String(init?.body))).toEqual({
        aliases: [],
        cultural_context: null,
      });
      return Response.json({
        ...PERSONAL,
        aliases: [],
        cultural_context: null,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await patchEntry(
      new Request(`http://localhost:3000/api/dictionary/${PERSONAL.id}`, {
        method: "PATCH",
        headers: sameOriginHeaders(),
        body: JSON.stringify({ aliases: [], cultural_context: null }),
      }),
      { params: Promise.resolve({ entryId: PERSONAL.id }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entry.aliases).toEqual([]);
    expect(body.entry.cultural_context).toBeNull();
    expect(body.entry.term).toBe("Agbada");
  });

  it("does not send an empty patch", async () => {
    cookieState.token = "valid-token";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await patchEntry(
      new Request("http://localhost:3000/api/dictionary/personal-1", {
        method: "PATCH",
        headers: sameOriginHeaders(),
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ entryId: "personal-1" }) },
    );
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects writes to a shared entry", async () => {
    cookieState.token = "valid-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ detail: "Shared dictionary entries are read-only" }, { status: 403 }),
      ),
    );
    const patch = await patchEntry(
      new Request("http://localhost:3000/api/dictionary/kurta", {
        method: "PATCH",
        headers: sameOriginHeaders(),
        body: JSON.stringify({ term: "Changed" }),
      }),
      { params: Promise.resolve({ entryId: "kurta" }) },
    );
    expect(patch.status).toBe(403);
    const deleted = await deleteEntry(
      new Request("http://localhost:3000/api/dictionary/kurta", {
        method: "DELETE",
        headers: sameOriginHeaders(),
      }),
      { params: Promise.resolve({ entryId: "kurta" }) },
    );
    expect(deleted.status).toBe(403);
    expect((await deleted.json()).error).toMatch(/read-only/i);
  });

  it("deletes a personal entry", async () => {
    cookieState.token = "valid-token";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    const response = await deleteEntry(
      new Request(`http://localhost:3000/api/dictionary/${PERSONAL.id}`, {
        method: "DELETE",
        headers: sameOriginHeaders(),
      }),
      { params: Promise.resolve({ entryId: PERSONAL.id }) },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
  });

  it("rejects cross-origin dictionary changes", async () => {
    cookieState.token = "valid-token";
    const response = await createEntry(
      new Request("http://localhost:3000/api/dictionary", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          term: "Agbada",
          definition: "A robe.",
          kind: "garment",
        }),
      }),
    );
    expect(response.status).toBe(403);
  });
});
