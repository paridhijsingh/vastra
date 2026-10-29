export const ASKING_NEMOTRON_MESSAGE = "Asking Nemotron…";
export const MODEL_UNAVAILABLE_MESSAGE = "Model unavailable — try again in a minute";
export const ADD_AVAILABLE_ITEM_MESSAGE = "Add at least one available item first";

export type NemotronTier = "Nano" | "Super" | "Ultra";

export function styledByBadge(tier: NemotronTier): string {
  return `Styled by Nemotron ${tier} via Nebius Token Factory`;
}

export const NEMOTRON_NANO_BADGE = styledByBadge("Nano");
export const NEMOTRON_SUPER_BADGE = styledByBadge("Super");
export const NEMOTRON_ULTRA_BADGE = styledByBadge("Ultra");

export const HOW_IT_WORKS_INTRO =
  "Looks are generated through Nebius Token Factory. Vastra does not send you to a store.";

export const HOW_IT_WORKS_MODELS = [
  { tier: "Nano" as const, use: "Emergency Fit and Rescue My Outfit" },
  { tier: "Super" as const, use: "Stylist chat" },
  { tier: "Ultra" as const, use: "Trend Stylist" },
] as const;

export function generateFailureMessage(status: number, fallback: string): string {
  if (status === 503 || status === 504) return MODEL_UNAVAILABLE_MESSAGE;
  return fallback;
}

export function garmentWhyLine(input: { categoryLabel: string; color?: string | null; notes?: string }): string {
  const notes = input.notes?.trim() ?? "";
  if (notes) return notes;
  const color = input.color?.trim();
  if (color) return `Available ${color} ${input.categoryLabel.toLowerCase()} from your wardrobe.`;
  return `Available ${input.categoryLabel.toLowerCase()} from your wardrobe.`;
}

export function incompleteOutfitNote(categories: readonly string[]): string | null {
  const set = new Set(categories);
  const missing: string[] = [];
  if (!set.has("one_piece")) {
    if (!set.has("top")) missing.push("a top");
    if (!set.has("bottom")) missing.push("a bottom");
  }
  if (!set.has("shoes")) missing.push("shoes");
  if (missing.length === 0) return null;
  if (missing.length === 1) {
    return `This outfit is incomplete: ${missing[0]} ${missing[0] === "shoes" ? "are" : "is"} missing.`;
  }
  const last = missing[missing.length - 1];
  return `This outfit is incomplete: ${missing.slice(0, -1).join(", ")} and ${last} are missing.`;
}
