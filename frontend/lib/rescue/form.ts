import { ADD_AVAILABLE_ITEM_MESSAGE } from "@/lib/ai";
import {
  AI_SUGGESTION_NOTE,
  OCCASION_MAX,
  categoryLabel,
  parseComfortNeeds,
  wardrobeGate,
  type WardrobeGate,
} from "@/lib/emergency/form";

export { AI_SUGGESTION_NOTE, categoryLabel, wardrobeGate };
export type { WardrobeGate };

export const CHANGE_REQUEST_MAX = 300;
export const OUTFIT_ITEM_MAX = 8;

export const RESCUE_EXPLANATION =
  "Replace one piece while keeping the rest. Uses available items from your wardrobe. Suggestions are saved only when you choose Save a look.";
export const SAME_CATEGORY_NOTE =
  "Replacements must be another available item of the same category.";
export const FINDING_REPLACEMENT_MESSAGE = "Asking Nemotron…";
export const NO_CANDIDATE_MESSAGE =
  "No other available item in that category can replace this piece.";
export const ITEMS_CHANGED_MESSAGE =
  "Those wardrobe items may have changed. Reload your wardrobe and try again.";
export const WARDROBE_LOAD_ERROR = "Could not load your wardrobe. Please try again.";
export const EMPTY_WARDROBE_MESSAGE = ADD_AVAILABLE_ITEM_MESSAGE;

export type RescueField = "occasion" | "change_request" | "comfort_needs" | "item_ids" | "replace_item_id";

export type RescueFieldErrors = Partial<Record<RescueField, string>>;

export type AvailableItem = {
  id: string;
  name: string;
  category: string;
  color: string;
  notes: string;
};

export type RescueBody = {
  item_ids: string[];
  replace_item_id: string;
  occasion: string;
  change_request: string;
  comfort_needs: string[];
};

export type RescueCard = {
  name: string;
  category: string;
  color: string;
  notes: string;
  role: "Replaced" | "Kept";
};

export type RescueView = {
  title: string;
  headline: string;
  cards: RescueCard[];
  itemIds: string[];
  explanation: string;
  limitations: string;
  styling_tips: string[];
};

export type RescueFormState = {
  selectedIds: string[];
  replaceItemId: string | null;
  occasion: string;
  changeRequest: string;
  comfortText: string;
  result: RescueView | null;
};

export type RescueDecision =
  | { status: "blocked" }
  | { status: "invalid"; errors: RescueFieldErrors }
  | { status: "ready"; body: RescueBody };

const ITEM_CATEGORIES = [
  "top",
  "bottom",
  "one_piece",
  "outerwear",
  "shoes",
  "accessory",
  "other",
] as const;

export function toggleOutfitItem(state: RescueFormState, itemId: string): RescueFormState {
  const selected = new Set(state.selectedIds);
  if (selected.has(itemId)) {
    selected.delete(itemId);
    return {
      ...state,
      selectedIds: state.selectedIds.filter((id) => id !== itemId),
      replaceItemId: state.replaceItemId === itemId ? null : state.replaceItemId,
      result: null,
    };
  }
  if (state.selectedIds.length >= OUTFIT_ITEM_MAX) {
    return state;
  }
  return {
    ...state,
    selectedIds: [...state.selectedIds, itemId],
    result: null,
  };
}

export function chooseReplacement(state: RescueFormState, itemId: string): RescueFormState {
  if (!state.selectedIds.includes(itemId)) {
    return { ...state, replaceItemId: null, result: null };
  }
  return { ...state, replaceItemId: itemId, result: null };
}

export function syncSelectionToWardrobe(state: RescueFormState, items: AvailableItem[]): RescueFormState {
  const allowed = new Set(items.map((item) => item.id));
  const selectedIds = state.selectedIds.filter((id) => allowed.has(id));
  const replaceItemId =
    state.replaceItemId && selectedIds.includes(state.replaceItemId) ? state.replaceItemId : null;
  return { ...state, selectedIds, replaceItemId };
}

export function orderedSelection(items: AvailableItem[], selectedIds: string[]): string[] {
  const selected = new Set(selectedIds);
  return items.map((item) => item.id).filter((id) => selected.has(id));
}

export function replacementCandidateCount(
  items: AvailableItem[],
  selectedIds: string[],
  replaceItemId: string | null,
): number {
  if (!replaceItemId) return 0;
  const selected = items.find((item) => item.id === replaceItemId);
  if (!selected || !selectedIds.includes(replaceItemId)) return 0;
  const outfit = new Set(selectedIds);
  return items.filter((item) => item.category === selected.category && !outfit.has(item.id)).length;
}

export function keepingIds(selectedIds: string[], replaceItemId: string | null): string[] {
  return selectedIds.filter((id) => id !== replaceItemId);
}

export function canSubmitRescue(input: {
  gate: WardrobeGate;
  pending: boolean;
  replaceItemId: string | null;
  candidateCount: number;
}): boolean {
  if (input.pending || input.gate.status !== "ready") return false;
  if (!input.replaceItemId) return true;
  return input.candidateCount > 0;
}

export function rescueDecision(input: {
  pending: boolean;
  items: AvailableItem[];
  selectedIds: string[];
  replaceItemId: string | null;
  occasion: string;
  changeRequest: string;
  comfortText: string;
}): RescueDecision {
  if (input.pending) return { status: "blocked" };
  const errors = validateRescueFields(input);
  if (Object.keys(errors).length > 0) return { status: "invalid", errors };
  return {
    status: "ready",
    body: {
      item_ids: orderedSelection(input.items, input.selectedIds),
      replace_item_id: input.replaceItemId ?? "",
      occasion: input.occasion.trim(),
      change_request: input.changeRequest.trim(),
      comfort_needs: comfortLines(input.comfortText),
    },
  };
}

export function validateRescueFields(input: {
  items: AvailableItem[];
  selectedIds: string[];
  replaceItemId: string | null;
  occasion: string;
  changeRequest: string;
  comfortText: string;
}): RescueFieldErrors {
  const errors: RescueFieldErrors = {};
  const itemIds = orderedSelection(input.items, input.selectedIds);
  if (itemIds.length === 0) {
    errors.item_ids = "Select at least one piece in the current outfit.";
  } else if (itemIds.length > OUTFIT_ITEM_MAX) {
    errors.item_ids = "Select at most 8 pieces.";
  }
  if (!input.replaceItemId || !itemIds.includes(input.replaceItemId)) {
    errors.replace_item_id = "Choose one selected piece to replace.";
  }
  const occasion = input.occasion.trim();
  if (!occasion) {
    errors.occasion = "Occasion is required.";
  } else if (occasion.length > OCCASION_MAX) {
    errors.occasion = "Occasion must be at most 200 characters.";
  }
  const changeRequest = input.changeRequest.trim();
  if (!changeRequest) {
    errors.change_request = "Describe what you would like to change.";
  } else if (changeRequest.length > CHANGE_REQUEST_MAX) {
    errors.change_request = "What you would like to change must be at most 300 characters.";
  }
  const comfort = parseComfortNeeds(input.comfortText);
  if (!comfort.ok) {
    errors.comfort_needs = comfort.error;
  }
  return errors;
}

function comfortLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function readRescueRequest(
  body: unknown,
): { ok: true; body: RescueBody } | { ok: false; status: 400 | 422; error: string; fields: RescueFieldErrors } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request body.", fields: {} };
  }
  const record = body as Record<string, unknown>;
  if ("owner_id" in record || "profile" in record) {
    return { ok: false, status: 422, error: "That field cannot be set by the client.", fields: {} };
  }
  const allowed = new Set(["item_ids", "replace_item_id", "occasion", "change_request", "comfort_needs"]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return { ok: false, status: 422, error: "That field cannot be set by the client.", fields: {} };
    }
  }
  if (!Array.isArray(record.item_ids) || record.item_ids.some((item) => typeof item !== "string")) {
    return {
      ok: false,
      status: 422,
      error: "Check the outfit selection and try again.",
      fields: { item_ids: "Select the pieces in the current outfit." },
    };
  }
  if (typeof record.replace_item_id !== "string" || typeof record.occasion !== "string" || typeof record.change_request !== "string") {
    return {
      ok: false,
      status: 422,
      error: "Check the outfit selection and try again.",
      fields: { replace_item_id: "Choose one selected piece to replace." },
    };
  }
  if (record.comfort_needs != null && !Array.isArray(record.comfort_needs)) {
    return {
      ok: false,
      status: 422,
      error: "Check the comfort needs and try again.",
      fields: { comfort_needs: "Comfort needs must be a list." },
    };
  }
  if (Array.isArray(record.comfort_needs) && record.comfort_needs.some((item) => typeof item !== "string")) {
    return {
      ok: false,
      status: 422,
      error: "Check the comfort needs and try again.",
      fields: { comfort_needs: "Each comfort need must not be blank." },
    };
  }
  const items = record.item_ids.map((id) => ({
    id,
    name: id,
    category: "top",
    color: "",
    notes: "",
  }));
  const decision = rescueDecision({
    pending: false,
    items,
    selectedIds: record.item_ids,
    replaceItemId: record.replace_item_id,
    occasion: record.occasion,
    changeRequest: record.change_request,
    comfortText: Array.isArray(record.comfort_needs) ? record.comfort_needs.join("\n") : "",
  });
  if (decision.status === "invalid") {
    return {
      ok: false,
      status: 422,
      error: "Check the outfit and try again.",
      fields: decision.errors,
    };
  }
  if (decision.status !== "ready") {
    return { ok: false, status: 400, error: "Invalid request body.", fields: {} };
  }
  return { ok: true, body: decision.body };
}

export function availableItemsFromApi(data: unknown): AvailableItem[] | null {
  if (!Array.isArray(data)) return null;
  const items: AvailableItem[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      typeof row.category !== "string" ||
      typeof row.color !== "string" ||
      typeof row.notes !== "string" ||
      !(ITEM_CATEGORIES as readonly string[]).includes(row.category)
    ) {
      return null;
    }
    items.push({
      id: row.id,
      name: row.name,
      category: row.category,
      color: row.color,
      notes: row.notes,
    });
  }
  return items;
}

export function rescueOutfitFromApi(data: unknown): {
  title: string;
  items: Array<{ id: string; name: string; category: string; color: string; notes: string }>;
  explanation: string;
  styling_tips: string[];
  limitations: string;
  replaced_item_id: string;
  replacement_item_id: string;
} | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (
    typeof record.title !== "string" ||
    typeof record.explanation !== "string" ||
    typeof record.limitations !== "string" ||
    typeof record.replaced_item_id !== "string" ||
    !record.replaced_item_id.trim() ||
    typeof record.replacement_item_id !== "string" ||
    !record.replacement_item_id.trim() ||
    !Array.isArray(record.items) ||
    record.items.length === 0 ||
    !Array.isArray(record.styling_tips)
  ) {
    return null;
  }
  const items: Array<{ id: string; name: string; category: string; color: string; notes: string }> = [];
  const itemIds: string[] = [];
  for (const item of record.items) {
    if (!item || typeof item !== "object") return null;
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
      id: row.id.trim(),
      name: row.name,
      category: row.category,
      color: row.color,
      notes: row.notes,
    });
  }
  if (new Set(itemIds).size !== itemIds.length) return null;
  const replacementId = record.replacement_item_id.trim();
  if (!itemIds.includes(replacementId)) return null;
  const styling_tips: string[] = [];
  for (const tip of record.styling_tips) {
    if (typeof tip !== "string") return null;
    styling_tips.push(tip);
  }
  return {
    title: record.title,
    items,
    explanation: record.explanation,
    styling_tips,
    limitations: record.limitations,
    replaced_item_id: record.replaced_item_id.trim(),
    replacement_item_id: replacementId,
  };
}

export function rescueViewFromApi(data: unknown, namesById: Record<string, string>): RescueView | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (
    typeof record.title !== "string" ||
    typeof record.explanation !== "string" ||
    typeof record.limitations !== "string" ||
    typeof record.replaced_item_id !== "string" ||
    typeof record.replacement_item_id !== "string" ||
    !Array.isArray(record.items) ||
    !Array.isArray(record.styling_tips)
  ) {
    return null;
  }
  const cards: RescueCard[] = [];
  const itemIds: string[] = [];
  let replacementName = "";
  for (const item of record.items) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      typeof row.category !== "string" ||
      typeof row.color !== "string" ||
      typeof row.notes !== "string"
    ) {
      return null;
    }
    if (row.id === record.replacement_item_id) {
      replacementName = row.name;
    }
    itemIds.push(row.id);
    cards.push({
      name: row.name,
      category: row.category,
      color: row.color,
      notes: row.notes,
      role: row.id === record.replacement_item_id ? "Replaced" : "Kept",
    });
  }
  const originalName = namesById[record.replaced_item_id];
  if (!originalName || !replacementName) return null;
  const styling_tips: string[] = [];
  for (const tip of record.styling_tips) {
    if (typeof tip !== "string") return null;
    styling_tips.push(tip);
  }
  if (new Set(itemIds).size !== itemIds.length) return null;
  return {
    title: record.title,
    headline: `Replaced ${originalName} with ${replacementName}`,
    cards,
    itemIds,
    explanation: record.explanation,
    limitations: record.limitations,
    styling_tips,
  };
}

export function fieldErrorsFromApiDetail(detail: unknown): RescueFieldErrors {
  if (!Array.isArray(detail)) return {};
  const errors: RescueFieldErrors = {};
  for (const item of detail) {
    if (!item || typeof item !== "object" || !("loc" in item)) continue;
    const loc = (item as { loc: unknown }).loc;
    if (!Array.isArray(loc)) continue;
    const field = loc.filter((part) => part !== "body").map(String)[0];
    if (
      field !== "occasion" &&
      field !== "change_request" &&
      field !== "comfort_needs" &&
      field !== "item_ids" &&
      field !== "replace_item_id"
    ) {
      continue;
    }
    if (errors[field]) continue;
    errors[field] = usefulFieldMessage(field);
  }
  return errors;
}

function usefulFieldMessage(field: RescueField): string {
  if (field === "occasion") return "Occasion is required.";
  if (field === "change_request") return "Describe what you would like to change.";
  if (field === "item_ids") return "Select the pieces in the current outfit.";
  if (field === "replace_item_id") return "Choose one selected piece to replace.";
  return "Check the comfort needs and try again.";
}
