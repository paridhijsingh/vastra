export const ITEM_CATEGORIES = [
  "top",
  "bottom",
  "one_piece",
  "outerwear",
  "shoes",
  "accessory",
  "other",
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const AVAILABILITY_STATUSES = [
  "available",
  "in_laundry",
  "packed_away",
] as const;

export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export type WardrobeItemCreate = {
  name: string;
  category: ItemCategory;
  color: string;
  notes: string;
  availability: AvailabilityStatus;
};

export type WardrobeItemUpdate = {
  name?: string;
  category?: ItemCategory;
  color?: string;
  notes?: string;
  availability?: AvailabilityStatus;
};

export type WardrobeItemPublic = {
  id: string;
  owner_id: string;
  name: string;
  category: ItemCategory;
  color: string;
  notes: string;
  availability: AvailabilityStatus;
};

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  top: "Top",
  bottom: "Bottom",
  one_piece: "One piece",
  outerwear: "Outerwear",
  shoes: "Shoes",
  accessory: "Accessory",
  other: "Other",
};

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: "Available",
  in_laundry: "In laundry",
  packed_away: "Packed away",
};

export const EMPTY_ITEM_FORM: WardrobeItemCreate = {
  name: "",
  category: "top",
  color: "",
  notes: "",
  availability: "available",
};

export function isItemCategory(value: string): value is ItemCategory {
  return (ITEM_CATEGORIES as readonly string[]).includes(value);
}

export function isAvailabilityStatus(value: string): value is AvailabilityStatus {
  return (AVAILABILITY_STATUSES as readonly string[]).includes(value);
}

/** Build a PATCH body with only fields that differ from the saved item. */
export function diffWardrobeUpdate(
  original: WardrobeItemPublic,
  next: WardrobeItemCreate,
): WardrobeItemUpdate {
  const patch: WardrobeItemUpdate = {};
  if (next.name !== original.name) patch.name = next.name;
  if (next.category !== original.category) patch.category = next.category;
  if (next.color !== original.color) patch.color = next.color;
  if (next.notes !== original.notes) patch.notes = next.notes;
  if (next.availability !== original.availability) {
    patch.availability = next.availability;
  }
  return patch;
}
