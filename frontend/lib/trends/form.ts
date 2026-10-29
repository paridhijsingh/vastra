import { PAGE_DESCRIPTIONS } from "@/lib/help";

export const OCCASION_MAX = 200;
export const VIBE_MAX = 200;
export const BUDGET_MAX = 200;

export const TREND_UNAVAILABLE_MESSAGE = "Trend search unavailable right now";
export const SEARCHING_TRENDS_MESSAGE = "Searching retrieved sources…";
export const BUDGET_PARSE_MESSAGE =
  "Enter a number for budget, with an optional currency such as USD, or write no shopping.";
export const TREND_PAGE_EXPLANATION = PAGE_DESCRIPTIONS.trends;

const CURRENCY_NAMES: Record<string, string> = {
  usd: "USD",
  eur: "EUR",
  gbp: "GBP",
  inr: "INR",
  rs: "INR",
  rupee: "INR",
  rupees: "INR",
  dollar: "USD",
  dollars: "USD",
  euro: "EUR",
  euros: "EUR",
  pound: "GBP",
  pounds: "GBP",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₹": "INR",
};

export function parseBudgetInput(
  raw: string,
): { ok: true; budget: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Budget is required." };
  if (/^no\s+shopping$/i.test(trimmed)) return { ok: true, budget: "no shopping" };
  if (trimmed.length > BUDGET_MAX) return { ok: false, error: `Budget must be at most ${BUDGET_MAX} characters.` };

  let currency: string | null = null;
  let rest = trimmed.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const leading = rest[0];
  if (leading && CURRENCY_SYMBOLS[leading]) {
    currency = CURRENCY_SYMBOLS[leading];
    rest = rest.slice(1).trim();
  }

  const tokens = rest.split(" ").filter(Boolean);
  const leftover: string[] = [];
  let amount: string | null = null;
  for (const token of tokens) {
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      if (amount) return { ok: false, error: BUDGET_PARSE_MESSAGE };
      amount = token;
      continue;
    }
    const glued = token.match(/^(\d+(?:\.\d+)?)([A-Za-z]+)$/);
    if (glued) {
      if (amount) return { ok: false, error: BUDGET_PARSE_MESSAGE };
      amount = glued[1];
      const named = CURRENCY_NAMES[glued[2].toLowerCase()];
      if (!named) return { ok: false, error: BUDGET_PARSE_MESSAGE };
      currency = currency ?? named;
      continue;
    }
    leftover.push(token);
  }

  if (!amount) return { ok: false, error: BUDGET_PARSE_MESSAGE };
  for (const token of leftover) {
    const named = CURRENCY_NAMES[token.toLowerCase()];
    if (!named) return { ok: false, error: BUDGET_PARSE_MESSAGE };
    currency = currency ?? named;
  }

  const budget = currency ? `${amount} ${currency}` : amount;
  if (budget.length > BUDGET_MAX) return { ok: false, error: `Budget must be at most ${BUDGET_MAX} characters.` };
  return { ok: true, budget };
}

export function fillBudgetInIdea(idea: string, budget: string): string {
  const value = budget.trim();
  if (!value || /^no\s+shopping$/i.test(value)) return idea;
  return idea
    .replace(/priced at or near\s*[,;:]+/gi, `priced at or near ${value}`)
    .replace(/\s+/g, " ")
    .trim();
}

export type TrendField = "occasion" | "vibe" | "budget";
export type TrendFieldErrors = Partial<Record<TrendField, string>>;

export type TrendRequestBody = {
  occasion: string;
  vibe: string;
  budget: string;
};

export type TrendSourceView = {
  title: string;
  url: string;
  publishedDate: string | null;
  retrievedDate: string;
};

export type TrendIdeaView = {
  outfitIdea: string;
  retrievalDate: string;
  basedOn: string;
  sources: TrendSourceView[];
};

export type TrendDecision =
  | { status: "blocked" }
  | { status: "invalid"; errors: TrendFieldErrors }
  | { status: "ready"; body: TrendRequestBody };

export function basedOnRetrievedSources(date: string): string {
  return `based on retrieved sources from ${date}`;
}

export function trendRequestBody(values: {
  occasion: string;
  vibe: string;
  budget: string;
}): TrendRequestBody {
  const parsed = parseBudgetInput(values.budget);
  return {
    occasion: values.occasion.trim(),
    vibe: values.vibe.trim(),
    budget: parsed.ok ? parsed.budget : values.budget.trim(),
  };
}

export function fieldError(field: TrendField, value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    if (field === "occasion") return "Occasion is required.";
    if (field === "vibe") return "Vibe is required.";
    return "Budget is required.";
  }
  const max = field === "occasion" ? OCCASION_MAX : field === "vibe" ? VIBE_MAX : BUDGET_MAX;
  if (trimmed.length > max) {
    const label = field === "occasion" ? "Occasion" : field === "vibe" ? "Vibe" : "Budget";
    return `${label} must be at most ${max} characters.`;
  }
  if (field === "budget") {
    const parsed = parseBudgetInput(trimmed);
    if (!parsed.ok) return parsed.error;
  }
  return undefined;
}

export function generationRequest(values: {
  pending: boolean;
  occasion: string;
  vibe: string;
  budget: string;
}): TrendDecision {
  if (values.pending) {
    return { status: "blocked" };
  }
  const errors: TrendFieldErrors = {};
  const occasionError = fieldError("occasion", values.occasion);
  const vibeError = fieldError("vibe", values.vibe);
  const budgetError = fieldError("budget", values.budget);
  if (occasionError) errors.occasion = occasionError;
  if (vibeError) errors.vibe = vibeError;
  if (budgetError) errors.budget = budgetError;
  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors };
  }
  return { status: "ready", body: trendRequestBody(values) };
}

export function readTrendRequest(
  body: unknown,
):
  | { ok: true; body: TrendRequestBody }
  | { ok: false; status: 400 | 422; error: string; fields: TrendFieldErrors } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request body.", fields: {} };
  }
  const record = body as Record<string, unknown>;
  const allowed = new Set(["occasion", "vibe", "budget"]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return { ok: false, status: 422, error: "That field cannot be set by the client.", fields: {} };
    }
  }
  if (typeof record.occasion !== "string" || typeof record.vibe !== "string" || typeof record.budget !== "string") {
    return {
      ok: false,
      status: 422,
      error: "Occasion, vibe, and budget are required.",
      fields: {},
    };
  }
  const decision = generationRequest({
    pending: false,
    occasion: record.occasion,
    vibe: record.vibe,
    budget: record.budget,
  });
  if (decision.status !== "ready") {
    return {
      ok: false,
      status: 422,
      error: "Check the highlighted fields and try again.",
      fields: decision.status === "invalid" ? decision.errors : {},
    };
  }
  return { ok: true, body: decision.body };
}

export function fieldErrorsFromApiDetail(detail: unknown): TrendFieldErrors {
  if (!Array.isArray(detail)) {
    return {};
  }
  const errors: TrendFieldErrors = {};
  for (const item of detail) {
    if (!item || typeof item !== "object" || !("loc" in item)) {
      continue;
    }
    const loc = (item as { loc: unknown }).loc;
    if (!Array.isArray(loc)) {
      continue;
    }
    const field = loc.filter((part) => part !== "body").map(String)[0];
    if (field !== "occasion" && field !== "vibe" && field !== "budget") {
      continue;
    }
    if (errors[field]) {
      continue;
    }
    errors[field] = fieldError(field, "") ?? "Check this field and try again.";
  }
  return errors;
}

export function ideaFromApi(data: unknown): TrendIdeaView | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (typeof record.outfit_idea !== "string" || !record.outfit_idea.trim()) {
    return null;
  }
  if (typeof record.retrieval_date !== "string" || !record.retrieval_date.trim()) {
    return null;
  }
  if (!Array.isArray(record.sources) || record.sources.length === 0) {
    return null;
  }
  const sources: TrendSourceView[] = [];
  for (const row of record.sources) {
    const source = sourceFromApi(row);
    if (!source) {
      return null;
    }
    sources.push(source);
  }
  const retrievalDate = record.retrieval_date.trim();
  return {
    outfitIdea: record.outfit_idea.trim(),
    retrievalDate,
    basedOn: basedOnRetrievedSources(retrievalDate),
    sources,
  };
}

export function ideaFromProxy(payload: unknown): TrendIdeaView | null {
  if (!payload || typeof payload !== "object" || !("idea" in payload)) {
    return null;
  }
  const idea = (payload as { idea: unknown }).idea;
  if (!idea || typeof idea !== "object") {
    return null;
  }
  const record = idea as Record<string, unknown>;
  if (typeof record.outfitIdea !== "string" || !record.outfitIdea.trim()) {
    return null;
  }
  if (typeof record.retrievalDate !== "string" || !record.retrievalDate.trim()) {
    return null;
  }
  if (typeof record.basedOn !== "string" || !record.basedOn.trim()) {
    return null;
  }
  if (!Array.isArray(record.sources) || record.sources.length === 0) {
    return null;
  }
  const sources: TrendSourceView[] = [];
  for (const row of record.sources) {
    if (!row || typeof row !== "object") {
      return null;
    }
    const source = row as Record<string, unknown>;
    if (typeof source.title !== "string" || !source.title.trim()) {
      return null;
    }
    if (typeof source.url !== "string" || !isHttpUrl(source.url)) {
      return null;
    }
    if (typeof source.retrievedDate !== "string" || !source.retrievedDate.trim()) {
      return null;
    }
    const published =
      source.publishedDate == null
        ? null
        : typeof source.publishedDate === "string" && source.publishedDate.trim()
          ? source.publishedDate.trim()
          : null;
    if (source.publishedDate != null && published == null) {
      return null;
    }
    sources.push({
      title: source.title.trim(),
      url: source.url.trim(),
      publishedDate: published,
      retrievedDate: source.retrievedDate.trim(),
    });
  }
  return {
    outfitIdea: record.outfitIdea.trim(),
    retrievalDate: record.retrievalDate.trim(),
    basedOn: record.basedOn.trim(),
    sources,
  };
}

function sourceFromApi(row: unknown): TrendSourceView | null {
  if (!row || typeof row !== "object") {
    return null;
  }
  const record = row as Record<string, unknown>;
  if (typeof record.title !== "string" || !record.title.trim()) {
    return null;
  }
  if (typeof record.url !== "string" || !isHttpUrl(record.url)) {
    return null;
  }
  if (typeof record.retrieved_date !== "string" || !record.retrieved_date.trim()) {
    return null;
  }
  const published =
    record.published_date == null
      ? null
      : typeof record.published_date === "string" && record.published_date.trim()
        ? record.published_date.trim()
        : null;
  if (record.published_date != null && published == null) {
    return null;
  }
  return {
    title: record.title.trim(),
    url: record.url.trim(),
    publishedDate: published,
    retrievedDate: record.retrieved_date.trim(),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
