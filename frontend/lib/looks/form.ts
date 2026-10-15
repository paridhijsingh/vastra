export const LOOK_NAME_MAX = 100;
export const LOOK_OCCASION_MAX = 200;
export const LOOK_NOTES_MAX = 1000;
export const LOOK_ITEM_MAX = 30;

export const LOOK_SAVED_MESSAGE = "Look saved";
export const LOOK_DELETED_MESSAGE = "Look deleted.";
export const LOOK_PLAN_NOTE =
  "A saved look is a plan. It may include laundry, packed-away, or removed pieces.";
export const REMOVED_ITEM_LABEL = "Wardrobe item removed";
export const DELETED_ITEM_SAVE_ERROR =
  "One of these wardrobe items was removed. The outfit was not saved.";
export const NO_LOOK_CHANGES = "No changes to save.";

export type LookField = "name" | "occasion" | "notes" | "item_ids";
export type LookFieldErrors = Partial<Record<LookField, string>>;

export type LookCreateBody = {
  name: string;
  item_ids: string[];
  occasion?: string;
  notes?: string;
};

export type LookPatchBody = {
  name?: string;
  occasion?: string | null;
  notes?: string | null;
};

export type LookSaveDecision =
  | { status: "blocked" }
  | { status: "invalid"; errors: LookFieldErrors }
  | { status: "ready"; body: LookCreateBody };

export type LookEditDecision =
  | { status: "blocked" }
  | { status: "invalid"; errors: LookFieldErrors }
  | { status: "unchanged" }
  | { status: "ready"; body: LookPatchBody };

export type LookAvailability = "available" | "in_laundry" | "packed_away";

export type LookItemView =
  | {
      missing: false;
      name: string;
      category: string;
      color: string;
      notes: string;
      availability: LookAvailability;
      availabilityLabel: string;
    }
  | { missing: true; label: typeof REMOVED_ITEM_LABEL };

export type LookView = {
  id: string;
  name: string;
  occasion: string | null;
  notes: string | null;
  containsRemovedItems: boolean;
  removedItemNotice: string | null;
  items: LookItemView[];
};

const CATEGORIES = [
  "top",
  "bottom",
  "one_piece",
  "outerwear",
  "shoes",
  "accessory",
  "other",
] as const;

const AVAILABILITY_LABELS: Record<LookAvailability, string> = {
  available: "Available",
  in_laundry: "In laundry",
  packed_away: "Packed away",
};

export function availabilityLabel(value: string): string | null {
  if (value === "available" || value === "in_laundry" || value === "packed_away") {
    return AVAILABILITY_LABELS[value];
  }
  return null;
}

export function saveLookRequest(input: {
  pending: boolean;
  name: string;
  occasion: string;
  notes: string;
  itemIds: readonly string[];
}): LookSaveDecision {
  if (input.pending) return { status: "blocked" };
  const errors = validateLookText(input);
  const itemIds = input.itemIds.map((id) => id.trim()).filter((id) => id.length > 0);
  if (itemIds.length === 0) {
    errors.item_ids = "Choose an outfit before saving it.";
  } else if (itemIds.length > LOOK_ITEM_MAX) {
    errors.item_ids = "A look can include at most 30 items.";
  } else if (new Set(itemIds).size !== itemIds.length) {
    errors.item_ids = "Each wardrobe item can appear only once.";
  }
  if (Object.keys(errors).length > 0) return { status: "invalid", errors };
  const body: LookCreateBody = { name: input.name.trim(), item_ids: itemIds };
  const occasion = input.occasion.trim();
  const notes = input.notes.trim();
  if (occasion) body.occasion = occasion;
  if (notes) body.notes = notes;
  return { status: "ready", body };
}

export function editLookRequest(input: {
  pending: boolean;
  original: { name: string; occasion: string | null; notes: string | null };
  name: string;
  occasion: string;
  notes: string;
}): LookEditDecision {
  if (input.pending) return { status: "blocked" };
  const errors = validateLookText(input);
  if (Object.keys(errors).length > 0) return { status: "invalid", errors };
  const body: LookPatchBody = {};
  const name = input.name.trim();
  if (name !== input.original.name) body.name = name;
  const occasion = input.occasion.trim();
  const nextOccasion = occasion.length > 0 ? occasion : null;
  if (nextOccasion !== input.original.occasion) body.occasion = nextOccasion;
  const notes = input.notes.trim();
  const nextNotes = notes.length > 0 ? notes : null;
  if (nextNotes !== input.original.notes) body.notes = nextNotes;
  if (Object.keys(body).length === 0) return { status: "unchanged" };
  return { status: "ready", body };
}

function validateLookText(input: { name: string; occasion: string; notes: string }): LookFieldErrors {
  const errors: LookFieldErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = "Name is required.";
  else if (name.length > LOOK_NAME_MAX) errors.name = "Name must be at most 100 characters.";
  if (input.occasion.trim().length > LOOK_OCCASION_MAX) {
    errors.occasion = "Occasion must be at most 200 characters.";
  }
  if (input.notes.trim().length > LOOK_NOTES_MAX) {
    errors.notes = "Notes must be at most 1000 characters.";
  }
  return errors;
}

export function readLookCreate(
  body: unknown,
): { ok: true; body: LookCreateBody } | { ok: false; status: 400 | 422; error: string; fields: LookFieldErrors } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request body.", fields: {} };
  }
  const record = body as Record<string, unknown>;
  if ("owner_id" in record || "profile" in record) {
    return { ok: false, status: 422, error: "That field cannot be set by the client.", fields: {} };
  }
  const allowed = new Set(["name", "occasion", "notes", "item_ids"]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return { ok: false, status: 422, error: "That field cannot be set by the client.", fields: {} };
    }
  }
  if (typeof record.name !== "string") {
    return { ok: false, status: 422, error: "Name is required.", fields: { name: "Name is required." } };
  }
  if (!Array.isArray(record.item_ids)) {
    return {
      ok: false,
      status: 422,
      error: "Check the outfit items and try again.",
      fields: { item_ids: "Choose an outfit before saving it." },
    };
  }
  if (record.item_ids.some((id) => typeof id !== "string")) {
    return {
      ok: false,
      status: 422,
      error: "Check the outfit items and try again.",
      fields: { item_ids: "Each wardrobe item can appear only once." },
    };
  }
  const decision = saveLookRequest({
    pending: false,
    name: record.name,
    occasion: typeof record.occasion === "string" ? record.occasion : "",
    notes: typeof record.notes === "string" ? record.notes : "",
    itemIds: record.item_ids,
  });
  if (decision.status === "invalid") {
    return { ok: false, status: 422, error: "Check the highlighted fields and try again.", fields: decision.errors };
  }
  if (decision.status !== "ready") {
    return { ok: false, status: 400, error: "Invalid request body.", fields: {} };
  }
  return { ok: true, body: decision.body };
}

export function readLookPatch(
  body: unknown,
): { ok: true; body: LookPatchBody } | { ok: false; status: 400 | 422; error: string; fields: LookFieldErrors } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request body.", fields: {} };
  }
  const record = body as Record<string, unknown>;
  const allowed = new Set(["name", "occasion", "notes"]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return { ok: false, status: 422, error: "That field cannot be set by the client.", fields: {} };
    }
  }
  if (Object.keys(record).length === 0) {
    return { ok: false, status: 422, error: NO_LOOK_CHANGES, fields: {} };
  }
  if ("name" in record && (record.name === null || typeof record.name !== "string" || !record.name.trim())) {
    return { ok: false, status: 422, error: "Name is required.", fields: { name: "Name is required." } };
  }
  if ("occasion" in record && record.occasion !== null && typeof record.occasion !== "string") {
    return { ok: false, status: 422, error: "Occasion must be text.", fields: { occasion: "Occasion must be text." } };
  }
  if ("notes" in record && record.notes !== null && typeof record.notes !== "string") {
    return { ok: false, status: 422, error: "Notes must be text.", fields: { notes: "Notes must be text." } };
  }
  const bodyOut: LookPatchBody = {};
  if (typeof record.name === "string") {
    const name = record.name.trim();
    if (name.length > LOOK_NAME_MAX) {
      return { ok: false, status: 422, error: "Name must be at most 100 characters.", fields: { name: "Name must be at most 100 characters." } };
    }
    bodyOut.name = name;
  }
  if ("occasion" in record) {
    if (record.occasion === null) bodyOut.occasion = null;
    else {
      const occasion = String(record.occasion).trim();
      if (occasion.length > LOOK_OCCASION_MAX) {
        return {
          ok: false,
          status: 422,
          error: "Occasion must be at most 200 characters.",
          fields: { occasion: "Occasion must be at most 200 characters." },
        };
      }
      bodyOut.occasion = occasion.length > 0 ? occasion : null;
    }
  }
  if ("notes" in record) {
    if (record.notes === null) bodyOut.notes = null;
    else {
      const notes = String(record.notes).trim();
      if (notes.length > LOOK_NOTES_MAX) {
        return {
          ok: false,
          status: 422,
          error: "Notes must be at most 1000 characters.",
          fields: { notes: "Notes must be at most 1000 characters." },
        };
      }
      bodyOut.notes = notes.length > 0 ? notes : null;
    }
  }
  if (Object.keys(bodyOut).length === 0) {
    return { ok: false, status: 422, error: NO_LOOK_CHANGES, fields: {} };
  }
  return { ok: true, body: bodyOut };
}

export function lookFromApi(data: unknown): LookView | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id.trim() || typeof record.name !== "string") return null;
  if (!Array.isArray(record.items)) return null;
  if (typeof record.contains_removed_items !== "boolean") return null;
  if (record.removed_item_notice !== null && typeof record.removed_item_notice !== "string") return null;
  const occasion = optionalText(record.occasion);
  const notes = optionalText(record.notes);
  if (occasion === undefined || notes === undefined) return null;
  const items: LookItemView[] = [];
  for (const item of record.items) {
    const parsed = lookItemFromApi(item);
    if (!parsed) return null;
    items.push(parsed);
  }
  return {
    id: record.id,
    name: record.name,
    occasion,
    notes,
    containsRemovedItems: record.contains_removed_items,
    removedItemNotice: record.removed_item_notice,
    items,
  };
}

function optionalText(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value;
  return undefined;
}

function lookItemFromApi(item: unknown): LookItemView | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  if (row.missing === true) {
    return { missing: true, label: REMOVED_ITEM_LABEL };
  }
  if (row.missing !== false) return null;
  const label = typeof row.availability === "string" ? availabilityLabel(row.availability) : null;
  if (
    !label ||
    typeof row.name !== "string" ||
    typeof row.category !== "string" ||
    !(CATEGORIES as readonly string[]).includes(row.category) ||
    typeof row.color !== "string" ||
    typeof row.notes !== "string" ||
    (row.availability !== "available" && row.availability !== "in_laundry" && row.availability !== "packed_away")
  ) {
    return null;
  }
  return {
    missing: false,
    name: row.name,
    category: row.category,
    color: row.color,
    notes: row.notes,
    availability: row.availability,
    availabilityLabel: label,
  };
}

export function looksFromApi(data: unknown): LookView[] | null {
  if (!Array.isArray(data)) return null;
  const looks: LookView[] = [];
  for (const item of data) {
    const look = lookFromApi(item);
    if (!look) return null;
    looks.push(look);
  }
  return looks;
}
