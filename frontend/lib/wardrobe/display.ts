import {
  AVAILABILITY_LABELS,
  CATEGORY_LABELS,
  type WardrobeItemPublic,
} from "@/lib/wardrobe/types";

export const FEATURED_MIN = 3;
export const FEATURED_COUNT = 3;

export type WardrobeSort = "added" | "name";

const COLOR_WASHES: Record<string, string> = {
  beige: "#d8cbb8",
  black: "#2a2a2a",
  blue: "#3d5a80",
  brown: "#6e5218",
  cream: "#efe4cc",
  gold: "#c4a14a",
  gray: "#7a756e",
  green: "#245447",
  grey: "#7a756e",
  ivory: "#f3ead8",
  maroon: "#6b2d2d",
  mustard: "#c4a14a",
  navy: "#1f3a5f",
  olive: "#245447",
  orange: "#c46b3a",
  pink: "#d4a5a0",
  purple: "#7a4e72",
  red: "#9a3a28",
  rust: "#a3522c",
  silver: "#b8b3a8",
  teal: "#2f5d56",
  terracotta: "#b94732",
  white: "#f5f1ea",
  yellow: "#c4a14a",
};

/** Newest items from API order (`created_at` ascending). Not favorites. */
export function recentlyAdded(items: readonly WardrobeItemPublic[]): WardrobeItemPublic[] {
  if (items.length < FEATURED_MIN) return [];
  return items.slice(-FEATURED_COUNT).reverse();
}

export function itemMatchesQuery(item: WardrobeItemPublic, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystacks = [
    item.name,
    item.color,
    item.notes,
    CATEGORY_LABELS[item.category],
    AVAILABILITY_LABELS[item.availability],
  ];
  return haystacks.some((value) => value.toLowerCase().includes(needle));
}

export function sortWardrobeItems(
  items: readonly WardrobeItemPublic[],
  sort: WardrobeSort,
): WardrobeItemPublic[] {
  if (sort === "added") return [...items];
  return [...items].sort((left, right) => {
    const byName = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return left.id.localeCompare(right.id);
  });
}

export const COLLECTION_CATEGORY_ORDER: readonly WardrobeItemPublic["category"][] = [
  "top",
  "bottom",
  "shoes",
  "outerwear",
  "accessory",
  "one_piece",
  "other",
];

export type WardrobeCategoryGroup = {
  category: WardrobeItemPublic["category"];
  label: string;
  items: WardrobeItemPublic[];
};

export function groupWardrobeByCategory(items: readonly WardrobeItemPublic[]): WardrobeCategoryGroup[] {
  return COLLECTION_CATEGORY_ORDER.flatMap((category) => {
    const grouped = items.filter((item) => item.category === category);
    if (grouped.length === 0) return [];
    return [{ category, label: CATEGORY_LABELS[category], items: grouped }];
  });
}

export function visibleWardrobeItems(
  items: readonly WardrobeItemPublic[],
  query: string,
  sort: WardrobeSort,
): WardrobeItemPublic[] {
  return sortWardrobeItems(items.filter((item) => itemMatchesQuery(item, query)), sort);
}

/** Recognized color names only — unknown text stays on the default stage. */
export function colorWash(color: string): string | undefined {
  const tokens = color
    .trim()
    .toLowerCase()
    .split(/[\s,/+-]+/)
    .filter(Boolean);
  for (const token of tokens) {
    const wash = COLOR_WASHES[token];
    if (wash) return wash;
  }
  return undefined;
}

export function wardrobeCountLabel(loaded: number, visible: number, query: string): string {
  if (loaded === 1 && !query.trim()) return "1 piece";
  if (!query.trim()) return `${loaded} pieces`;
  if (visible === 1) return "1 matching piece";
  return `${visible} matching pieces`;
}
