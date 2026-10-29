import { ADD_AVAILABLE_ITEM_MESSAGE, ASKING_NEMOTRON_MESSAGE } from "@/lib/ai";

export const OCCASION_MAX = 200;
export const VIBE_MAX = 200;
export const COMFORT_NEED_MAX = 64;
export const COMFORT_NEED_COUNT_MAX = 16;

export const CREATING_OUTFIT_MESSAGE = ASKING_NEMOTRON_MESSAGE;
export const AI_SUGGESTION_NOTE = "AI suggestion—check suitability and comfort yourself.";
export const EMERGENCY_FIT_EXPLANATION =
  "Uses your available wardrobe items and saved style preferences. Suggestions are saved only when you choose Save a look.";
export const NO_AVAILABLE_ITEMS_MESSAGE = ADD_AVAILABLE_ITEM_MESSAGE;
export const WARDROBE_LOAD_ERROR =
  "Could not load your wardrobe. Please try again.";
export const PROFILE_MISSING_MESSAGE =
  "You do not have a saved style profile yet. You can still generate an outfit from your available clothes.";

export type EmergencyField = "occasion" | "vibe" | "comfort_needs";

export type EmergencyFieldErrors = Partial<Record<EmergencyField, string>>;

export type EmergencyFitBody = {
  occasion: string;
  vibe?: string;
  comfort_needs: string[];
};

export type OutfitItemView = {
  name: string;
  category: string;
  color: string;
  notes: string;
};

export type EmergencyOutfitView = {
  title: string;
  items: OutfitItemView[];
  itemIds: string[];
  explanation: string;
  styling_tips: string[];
  limitations: string;
};

export type GenerationDecision =
  | { status: "blocked" }
  | { status: "invalid"; errors: EmergencyFieldErrors }
  | { status: "ready"; body: EmergencyFitBody };

const ITEM_CATEGORIES = [
  "top",
  "bottom",
  "one_piece",
  "outerwear",
  "shoes",
  "accessory",
  "other",
] as const;

export function readEmergencyRequest(
  body: unknown,
): { ok: true; body: EmergencyFitBody } | { ok: false; status: 400 | 422; error: string; fields: EmergencyFieldErrors } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request body.", fields: {} };
  }
  const record = body as Record<string, unknown>;
  if ("owner_id" in record || "profile" in record) {
    return {
      ok: false,
      status: 422,
      error: "That field cannot be set by the client.",
      fields: {},
    };
  }
  const allowed = new Set(["occasion", "vibe", "comfort_needs"]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return { ok: false, status: 422, error: "That field cannot be set by the client.", fields: {} };
    }
  }
  if (typeof record.occasion !== "string") {
    return {
      ok: false,
      status: 422,
      error: "Check the occasion, vibe, and comfort needs and try again.",
      fields: { occasion: "Occasion is required." },
    };
  }
  if (record.vibe != null && typeof record.vibe !== "string") {
    return {
      ok: false,
      status: 422,
      error: "Check the occasion, vibe, and comfort needs and try again.",
      fields: { vibe: "Vibe must be at most 200 characters." },
    };
  }
  if (record.comfort_needs != null && !Array.isArray(record.comfort_needs)) {
    return {
      ok: false,
      status: 422,
      error: "Check the occasion, vibe, and comfort needs and try again.",
      fields: { comfort_needs: "Comfort needs must be a list." },
    };
  }
  const comfortLines = Array.isArray(record.comfort_needs)
    ? record.comfort_needs.map((item) => (typeof item === "string" ? item : " ")).join("\n")
    : "";
  if (Array.isArray(record.comfort_needs) && record.comfort_needs.some((item) => typeof item !== "string")) {
    return {
      ok: false,
      status: 422,
      error: "Check the occasion, vibe, and comfort needs and try again.",
      fields: { comfort_needs: "Each comfort need must not be blank." },
    };
  }
  const decision = generationRequest({
    pending: false,
    occasion: record.occasion,
    vibe: typeof record.vibe === "string" ? record.vibe : "",
    comfortText: comfortLines,
  });
  if (decision.status === "invalid") {
    return {
      ok: false,
      status: 422,
      error: "Check the occasion, vibe, and comfort needs and try again.",
      fields: decision.errors,
    };
  }
  if (decision.status !== "ready") {
    return { ok: false, status: 400, error: "Invalid request body.", fields: {} };
  }
  return { ok: true, body: decision.body };
}

export function generationRequest(input: {
  pending: boolean;
  occasion: string;
  vibe: string;
  comfortText: string;
}): GenerationDecision {
  if (input.pending) {
    return { status: "blocked" };
  }
  const errors = validateEmergencyFields(input);
  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors };
  }
  return { status: "ready", body: emergencyFitBody(input) };
}

export function validateEmergencyFields(input: {
  occasion: string;
  vibe: string;
  comfortText: string;
}): EmergencyFieldErrors {
  const errors: EmergencyFieldErrors = {};
  const occasion = input.occasion.trim();
  if (!occasion) {
    errors.occasion = "Occasion is required.";
  } else if (occasion.length > OCCASION_MAX) {
    errors.occasion = "Occasion must be at most 200 characters.";
  }
  const vibe = input.vibe.trim();
  if (vibe.length > VIBE_MAX) {
    errors.vibe = "Vibe must be at most 200 characters.";
  }
  const comfort = parseComfortNeeds(input.comfortText);
  if (!comfort.ok) {
    errors.comfort_needs = comfort.error;
  }
  return errors;
}

export function emergencyFitBody(input: {
  occasion: string;
  vibe: string;
  comfortText: string;
}): EmergencyFitBody {
  const body: EmergencyFitBody = {
    occasion: input.occasion.trim(),
    comfort_needs: comfortNeedLines(input.comfortText),
  };
  const vibe = input.vibe.trim();
  if (vibe) {
    body.vibe = vibe;
  }
  return body;
}

export function parseComfortNeeds(
  text: string,
): { ok: true } | { ok: false; error: string } {
  const lines = text.split(/\r?\n/);
  let count = 0;
  for (const line of lines) {
    if (line.length === 0) {
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) {
      return { ok: false, error: "Each comfort need must not be blank." };
    }
    if (trimmed.length > COMFORT_NEED_MAX) {
      return { ok: false, error: "Each comfort need must be at most 64 characters." };
    }
    count += 1;
  }
  if (count > COMFORT_NEED_COUNT_MAX) {
    return { ok: false, error: "Comfort needs must contain at most 16 items." };
  }
  return { ok: true };
}

function comfortNeedLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function fieldErrorsFromApiDetail(detail: unknown): EmergencyFieldErrors {
  if (!Array.isArray(detail)) {
    return {};
  }
  const errors: EmergencyFieldErrors = {};
  for (const item of detail) {
    if (!item || typeof item !== "object" || !("loc" in item)) {
      continue;
    }
    const loc = (item as { loc: unknown }).loc;
    if (!Array.isArray(loc)) {
      continue;
    }
    const field = loc.filter((part) => part !== "body").map(String)[0];
    if (field !== "occasion" && field !== "vibe" && field !== "comfort_needs") {
      continue;
    }
    if (errors[field]) {
      continue;
    }
    const msg = "msg" in item ? String((item as { msg: unknown }).msg) : "";
    errors[field] = usefulFieldMessage(field, msg);
  }
  return errors;
}

function usefulFieldMessage(field: EmergencyField, msg: string): string {
  const lower = msg.toLowerCase();
  if (field === "occasion") {
    if (lower.includes("200")) return "Occasion must be at most 200 characters.";
    return "Occasion is required.";
  }
  if (field === "vibe") {
    return "Vibe must be at most 200 characters.";
  }
  if (lower.includes("16")) return "Comfort needs must contain at most 16 items.";
  if (lower.includes("64")) return "Each comfort need must be at most 64 characters.";
  if (lower.includes("blank")) return "Each comfort need must not be blank.";
  return "Check the comfort needs and try again.";
}

export function outfitFromApi(data: unknown): EmergencyOutfitView | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (typeof record.title !== "string" || typeof record.explanation !== "string") {
    return null;
  }
  if (typeof record.limitations !== "string" || !Array.isArray(record.items)) {
    return null;
  }
  if (!Array.isArray(record.styling_tips)) {
    return null;
  }
  const items: OutfitItemView[] = [];
  const itemIds: string[] = [];
  for (const item of record.items) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      !row.id.trim() ||
      typeof row.name !== "string" ||
      typeof row.category !== "string" ||
      typeof row.color !== "string" ||
      typeof row.notes !== "string" ||
      !(ITEM_CATEGORIES as readonly string[]).includes(row.category)
    ) {
      return null;
    }
    itemIds.push(row.id.trim());
    items.push({
      name: row.name,
      category: row.category,
      color: row.color,
      notes: row.notes,
    });
  }
  if (new Set(itemIds).size !== itemIds.length) {
    return null;
  }
  const styling_tips: string[] = [];
  for (const tip of record.styling_tips) {
    if (typeof tip !== "string") {
      return null;
    }
    styling_tips.push(tip);
  }
  return {
    title: record.title,
    items,
    itemIds,
    explanation: record.explanation,
    styling_tips,
    limitations: record.limitations,
  };
}

/** The proxy already moved item ids off each card. Do not require the backend item shape again. */
export function renderedOutfitFromProxy(data: unknown): EmergencyOutfitView | null {
  if (!data || typeof data !== "object" || !("outfit" in data)) {
    return null;
  }
  const outfit = (data as { outfit: unknown }).outfit;
  if (!outfit || typeof outfit !== "object") {
    return null;
  }
  const record = outfit as Record<string, unknown>;
  if (
    typeof record.title !== "string" ||
    typeof record.explanation !== "string" ||
    typeof record.limitations !== "string" ||
    !Array.isArray(record.items) ||
    !Array.isArray(record.itemIds) ||
    !Array.isArray(record.styling_tips) ||
    record.itemIds.length !== record.items.length
  ) {
    return null;
  }
  const items: OutfitItemView[] = [];
  const itemIds: string[] = [];
  for (let index = 0; index < record.items.length; index += 1) {
    const item = record.items[index];
    const itemId = record.itemIds[index];
    if (!item || typeof item !== "object" || typeof itemId !== "string" || !itemId.trim()) {
      return null;
    }
    const row = item as Record<string, unknown>;
    if (
      typeof row.name !== "string" ||
      typeof row.category !== "string" ||
      typeof row.color !== "string" ||
      typeof row.notes !== "string" ||
      !(ITEM_CATEGORIES as readonly string[]).includes(row.category)
    ) {
      return null;
    }
    items.push({
      name: row.name,
      category: row.category,
      color: row.color,
      notes: row.notes,
    });
    itemIds.push(itemId.trim());
  }
  if (new Set(itemIds).size !== itemIds.length) {
    return null;
  }
  const styling_tips: string[] = [];
  for (const tip of record.styling_tips) {
    if (typeof tip !== "string") {
      return null;
    }
    styling_tips.push(tip);
  }
  return {
    title: record.title,
    items,
    itemIds,
    explanation: record.explanation,
    styling_tips,
    limitations: record.limitations,
  };
}

export function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    top: "Top",
    bottom: "Bottom",
    one_piece: "One piece",
    outerwear: "Outerwear",
    shoes: "Shoes",
    accessory: "Accessory",
    other: "Other",
  };
  return labels[category] ?? category;
}

export type WardrobeGate =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "ready" };

export function wardrobeGate(input: {
  loading: boolean;
  failed: boolean;
  availableCount: number;
}): WardrobeGate {
  if (input.loading) return { status: "loading" };
  if (input.failed) return { status: "error" };
  if (input.availableCount === 0) return { status: "empty" };
  return { status: "ready" };
}

export function canGenerateOutfit(gate: WardrobeGate, pending: boolean): boolean {
  return gate.status === "ready" && !pending;
}
