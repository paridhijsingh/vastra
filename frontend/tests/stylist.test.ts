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

import { POST as stylistChat } from "@/app/api/stylist/chat/route";
import { MODEL_PROXY_TIMEOUT_MS } from "@/lib/config";
import {
  MIXED_OUTFIT_SAVE_MESSAGE,
  SOURCE_LABELS,
  STYLIST_EXAMPLE_PROMPTS,
  STYLIST_HISTORY_MAX,
  STYLIST_INPUT_PLACEHOLDER,
  messageError,
  historyForRequest,
  replyFromApi,
  type StylistTurn,
} from "@/lib/stylist/form";

function sameOrigin(body: unknown): Request {
  return new Request("http://localhost:3000/api/stylist/chat", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const SAVED = {
  source: "saved_wardrobe",
  wardrobe_item_id: "shirt-1",
  name: "Ivory shirt",
  category: "top",
  color: "ivory",
  notes: "cotton",
  availability: "available",
  user_quote: null,
};

const DESCRIBED = {
  source: "described",
  wardrobe_item_id: null,
  name: "cream trousers",
  category: "bottom",
  color: null,
  notes: "",
  availability: "unknown",
  user_quote: "cream trousers",
};

beforeEach(() => {
  cookieState.token = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("stylist reply parsing", () => {
  it("keeps source labels and blocks a mixed outfit from Save a look", () => {
    const reply = replyFromApi({
      kind: "proposal",
      message: "Outfit 1: Ivory shirt and cream trousers",
      suggestions: [
        {
          title: "Ivory shirt and cream trousers",
          note: "Use the saved shirt.",
          summary: "Ivory shirt; cream trousers",
          pieces: [SAVED, DESCRIBED],
        },
      ],
    });
    expect(SOURCE_LABELS).toEqual({
      saved_wardrobe: "Saved wardrobe",
      described: "Described by you",
      suggested: "Suggested addition",
    });
    expect(reply?.suggestions[0]?.pieces.map((piece) => piece.sourceLabel)).toEqual([
      "Saved wardrobe",
      "Described by you",
    ]);
    expect(reply?.suggestions[0]?.pieces[1]?.availabilityLabel).toBe("Availability unknown.");
    expect(reply?.suggestions[0]?.lookItemIds).toBeNull();
    expect(MIXED_OUTFIT_SAVE_MESSAGE).toContain("entirely from saved wardrobe pieces");
    expect(STYLIST_EXAMPLE_PROMPTS.length).toBeGreaterThan(0);
    expect(STYLIST_INPUT_PLACEHOLDER).toMatch(/ask anything/i);
    expect(messageError("   ")).toBe("Enter a message.");
    expect(messageError("What should I wear for a beach picnic?")).toBeNull();
  });

  it("maps a proposal of saved pieces to wardrobe ids", () => {
    const reply = replyFromApi({
      kind: "proposal",
      message: "Outfit 1: Ivory shirt",
      suggestions: [
        {
          title: "Ivory shirt",
          note: "",
          summary: "Ivory shirt",
          pieces: [SAVED],
        },
      ],
    });
    expect(reply?.suggestions[0]?.lookItemIds).toEqual(["shirt-1"]);
  });

  it("limits history to twelve turns and 8000 characters", () => {
    const history: StylistTurn[] = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: "x".repeat(1000),
    }));
    const selected = historyForRequest(history, "hello");
    expect(selected.length).toBeLessThanOrEqual(12);
    expect(selected.reduce((sum, turn) => sum + turn.content.length, "hello".length)).toBeLessThanOrEqual(8000);
    expect(selected.at(-1)?.content).toBe(history.at(-1)?.content);
  });
});

describe("POST /api/stylist/chat", () => {
  it("requires a session and a same-origin request", async () => {
    const missing = await stylistChat(sameOrigin({ message: "What can I wear?" }));
    expect(missing.status).toBe(401);

    const crossOrigin = await stylistChat(
      new Request("http://localhost:3000/api/stylist/chat", {
        method: "POST",
        headers: { host: "localhost:3000", origin: "http://evil.example", "content-type": "application/json" },
        body: JSON.stringify({ message: "What can I wear?" }),
      }),
    );
    expect(crossOrigin.status).toBe(403);
  });

  it("rejects a client-supplied wardrobe and proxies the backend reply", async () => {
    cookieState.token = "session-token";
    const rejected = await stylistChat(sameOrigin({ message: "Help", wardrobe: [{ name: "secret" }] }));
    expect(rejected.status).toBe(422);

    const fetchMock = vi.fn(async () =>
      Response.json({
        kind: "clarification",
        message: "What is the occasion?",
        suggestions: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await stylistChat(
      sameOrigin({
        message: "  What can I wear?  ",
        history: [{ role: "user", content: "Earlier question" }],
      }),
    );
    expect(response.status).toBe(200);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent).toEqual({
      message: "What can I wear?",
      history: [{ role: "user", content: "Earlier question" }],
    });
    expect(sent.wardrobe).toBeUndefined();
    const body = await response.json();
    expect(body.reply.kind).toBe("clarification");
  });

  it("rejects history longer than the allowed maximum before calling the API", async () => {
    cookieState.token = "session-token";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const history = Array.from({ length: STYLIST_HISTORY_MAX + 1 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: "Earlier turn",
    }));
    const response = await stylistChat(sameOrigin({ message: "What can I wear?", history }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "Check the message and try again.", kind: "validation" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a fetch abort to a timeout without leaking internals", async () => {
    cookieState.token = "session-token";
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await stylistChat(sameOrigin({ message: "What can I wear?" }));
    expect(timeoutSpy).toHaveBeenCalledWith(MODEL_PROXY_TIMEOUT_MS);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeDefined();
    expect(response.status).toBe(504);
    const body = await response.json();
    expect(body).toEqual({ error: "The stylist request timed out. Please try again.", kind: "timeout" });
    expect(JSON.stringify(body)).not.toContain("The operation timed out");
  });
});
