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

import { POST as createTrendIdea } from "@/app/api/trends/route";
import { TRENDS_PROXY_TIMEOUT_MS } from "@/lib/trends/backend";
import {
  TREND_UNAVAILABLE_MESSAGE,
  basedOnRetrievedSources,
  generationRequest,
  ideaFromApi,
  ideaFromProxy,
  trendRequestBody,
} from "@/lib/trends/form";

const SOURCE = {
  title: "Fall evening looks 2026",
  url: "https://example.com/fall-evening-looks",
  published_date: "Mon, 12 Oct 2026 12:00:00 GMT",
  retrieved_date: "2026-10-28",
};

const IDEA = {
  outfit_idea: "A cream knit with tailored wool trousers for a relaxed dinner.",
  retrieval_date: "2026-10-28",
  sources: [SOURCE],
};

function sameOrigin(body: unknown): Request {
  return new Request("http://localhost:3000/api/trends", {
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

describe("trend stylist form", () => {
  it("builds a request from trimmed occasion, vibe, and budget", () => {
    const body = trendRequestBody({
      occasion: "  dinner with friends  ",
      vibe: "  relaxed  ",
      budget: "  no shopping  ",
    });
    expect(body).toEqual({
      occasion: "dinner with friends",
      vibe: "relaxed",
      budget: "no shopping",
    });
  });

  it("blocks a second submit while one is pending", () => {
    expect(
      generationRequest({
        pending: true,
        occasion: "dinner with friends",
        vibe: "relaxed",
        budget: "no shopping",
      }),
    ).toEqual({ status: "blocked" });
  });

  it("keeps field errors without starting a request", () => {
    const decision = generationRequest({
      pending: false,
      occasion: " ",
      vibe: "",
      budget: "no shopping",
    });
    expect(decision.status).toBe("invalid");
    if (decision.status === "invalid") {
      expect(decision.errors.occasion).toBe("Occasion is required.");
      expect(decision.errors.vibe).toBe("Vibe is required.");
    }
  });

  it("labels the idea with the retrieval date and keeps only http sources", () => {
    const view = ideaFromApi(IDEA);
    expect(view?.basedOn).toBe(basedOnRetrievedSources("2026-10-28"));
    expect(view?.basedOn).toBe("based on retrieved sources from 2026-10-28");
    expect(view?.sources).toEqual([
      {
        title: SOURCE.title,
        url: SOURCE.url,
        publishedDate: SOURCE.published_date,
        retrievedDate: SOURCE.retrieved_date,
      },
    ]);
    expect(
      ideaFromApi({
        ...IDEA,
        sources: [{ ...SOURCE, url: "javascript:alert(1)" }],
      }),
    ).toBeNull();
  });
});

describe("trend stylist proxy", () => {
  it("rejects an unauthenticated request", async () => {
    const response = await createTrendIdea(
      sameOrigin({ occasion: "dinner", vibe: "relaxed", budget: "no shopping" }),
    );
    expect(response.status).toBe(401);
  });

  it("forwards a successful idea and uses the longer trend timeout", async () => {
    cookieState.token = "session-token";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(IDEA), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await createTrendIdea(
      sameOrigin({ occasion: "dinner with friends", vibe: "relaxed", budget: "no shopping" }),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    const view = ideaFromProxy(payload);
    expect(view?.basedOn).toBe("based on retrieved sources from 2026-10-28");
    expect(view?.sources.map((source) => source.url)).toEqual([SOURCE.url]);
    expect(view?.outfitIdea).toBe(IDEA.outfit_idea);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as { signal?: AbortSignal };
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(TRENDS_PROXY_TIMEOUT_MS).toBe(100_000);
  });

  it("returns the honest unavailable message when the backend cannot search", async () => {
    cookieState.token = "session-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: TREND_UNAVAILABLE_MESSAGE }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const response = await createTrendIdea(
      sameOrigin({ occasion: "dinner with friends", vibe: "relaxed", budget: "no shopping" }),
    );
    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.error).toBe(TREND_UNAVAILABLE_MESSAGE);
  });
});
