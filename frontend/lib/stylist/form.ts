export const STYLIST_MESSAGE_MAX = 2000;
export const STYLIST_HISTORY_MAX = 12;
export const STYLIST_INPUT_MAX = 8000;

export const SOURCE_LABELS = {
  saved_wardrobe: "Saved wardrobe",
  described: "Described by you",
  suggested: "Suggested addition",
} as const;

export const STYLIST_EXAMPLE_PROMPTS = [
  "Plan a fusion dinner outfit from my wardrobe.",
  "I have a wedding this weekend. What can I wear?",
  "Replace the shirt with something cooler. Keep the pants.",
] as const;

export const MIXED_OUTFIT_SAVE_MESSAGE =
  "Save a look can only store outfits made entirely from saved wardrobe pieces. This outfit includes a garment you described or a suggested addition, so it cannot be saved yet.";

export type StylistRole = "user" | "assistant";
export type StylistKind = "clarification" | "proposal";
export type StylistSource = keyof typeof SOURCE_LABELS;

export type StylistTurn = {
  role: StylistRole;
  content: string;
};

export type StylistPieceView = {
  source: StylistSource;
  sourceLabel: string;
  wardrobeItemId: string | null;
  name: string;
  category: string;
  categoryLabel: string;
  color: string | null;
  notes: string;
  availability: "available" | "unknown";
  availabilityLabel: string;
};

export type StylistSuggestionView = {
  title: string;
  note: string;
  summary: string;
  pieces: StylistPieceView[];
  lookItemIds: string[] | null;
};

export type StylistReplyView = {
  kind: StylistKind;
  message: string;
  suggestions: StylistSuggestionView[];
};

const CATEGORY_LABELS: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  one_piece: "One piece",
  outerwear: "Outerwear",
  shoes: "Shoes",
  accessory: "Accessory",
  other: "Other",
};

const SOURCES = new Set<string>(Object.keys(SOURCE_LABELS));

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function messageError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Enter a message.";
  if (trimmed.length > STYLIST_MESSAGE_MAX) return "A message can be at most 2000 characters.";
  return null;
}

export function historyForRequest(history: readonly StylistTurn[], message: string): StylistTurn[] {
  const trimmed = message.trim();
  const recent = history.slice(-STYLIST_HISTORY_MAX);
  const selected: StylistTurn[] = [];
  let total = trimmed.length;
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const turn = recent[index];
    if (selected.length >= STYLIST_HISTORY_MAX) break;
    if (total + turn.content.length > STYLIST_INPUT_MAX) break;
    selected.push(turn);
    total += turn.content.length;
  }
  return selected.reverse();
}

function pieceFromApi(value: unknown): StylistPieceView | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.source !== "string" || !SOURCES.has(record.source)) return null;
  if (typeof record.name !== "string" || !record.name.trim()) return null;
  if (typeof record.category !== "string" || !(record.category in CATEGORY_LABELS)) return null;
  if (record.availability !== "available" && record.availability !== "unknown") return null;
  const source = record.source as StylistSource;
  const wardrobeItemId = typeof record.wardrobe_item_id === "string" && record.wardrobe_item_id.trim()
    ? record.wardrobe_item_id.trim()
    : null;
  if (source === "saved_wardrobe" && !wardrobeItemId) return null;
  if (source !== "saved_wardrobe" && wardrobeItemId) return null;
  return {
    source,
    sourceLabel: SOURCE_LABELS[source],
    wardrobeItemId,
    name: record.name.trim(),
    category: record.category,
    categoryLabel: categoryLabel(record.category),
    color: typeof record.color === "string" && record.color.trim() ? record.color.trim() : null,
    notes: typeof record.notes === "string" ? record.notes : "",
    availability: record.availability,
    availabilityLabel: record.availability === "available" ? "Available" : "Availability unknown.",
  };
}

function lookItemIds(pieces: readonly StylistPieceView[]): string[] | null {
  if (pieces.length === 0 || pieces.some((piece) => piece.source !== "saved_wardrobe" || !piece.wardrobeItemId)) {
    return null;
  }
  const ids = pieces.map((piece) => piece.wardrobeItemId as string);
  if (new Set(ids).size !== ids.length || ids.length > 30) return null;
  return ids;
}

export function replyFromApi(value: unknown): StylistReplyView | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "clarification" && record.kind !== "proposal") return null;
  if (typeof record.message !== "string" || !record.message.trim()) return null;
  if (!Array.isArray(record.suggestions)) return null;
  if (record.kind === "clarification" && record.suggestions.length > 0) return null;
  const suggestions: StylistSuggestionView[] = [];
  for (const item of record.suggestions) {
    if (!item || typeof item !== "object") return null;
    const suggestion = item as Record<string, unknown>;
    if (typeof suggestion.title !== "string" || !suggestion.title.trim()) return null;
    if (typeof suggestion.summary !== "string") return null;
    if (!Array.isArray(suggestion.pieces) || suggestion.pieces.length === 0) return null;
    const pieces: StylistPieceView[] = [];
    for (const pieceValue of suggestion.pieces) {
      const piece = pieceFromApi(pieceValue);
      if (!piece) return null;
      pieces.push(piece);
    }
    suggestions.push({
      title: suggestion.title.trim(),
      note: typeof suggestion.note === "string" ? suggestion.note : "",
      summary: suggestion.summary,
      pieces,
      lookItemIds: lookItemIds(pieces),
    });
  }
  if (record.kind === "proposal" && suggestions.length === 0) return null;
  return { kind: record.kind, message: record.message.trim(), suggestions };
}
