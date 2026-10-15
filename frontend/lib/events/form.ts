export const EVENT_NAME_MAX = 100;
export const EVENT_OCCASION_MAX = 200;
export const EVENT_NOTES_MAX = 1000;
export const EVENT_COMFORT_MAX_ITEMS = 20;
export const EVENT_COMFORT_MAX_LENGTH = 200;

export const EVENT_SAVED_MESSAGE = "Event saved.";
export const EVENT_DELETED_MESSAGE = "Event deleted.";
export const NO_EVENT_CHANGES = "No changes to save.";
export const NO_SAVED_LOOK_LABEL = "No saved look";
export const REMOVED_LOOK_LABEL = "Saved look removed";

export type EventField = "name" | "event_date" | "occasion" | "notes" | "comfort_needs" | "look_id";
export type EventFieldErrors = Partial<Record<EventField, string>>;

export type EventCreateBody = {
  name: string;
  event_date: string;
  occasion?: string;
  notes?: string;
  comfort_needs?: string[];
  look_id?: string;
};

export type EventPatchBody = {
  name?: string;
  event_date?: string;
  occasion?: string | null;
  notes?: string | null;
  comfort_needs?: string[];
  look_id?: string | null;
};

export type EventSaveDecision =
  | { status: "blocked" }
  | { status: "invalid"; errors: EventFieldErrors }
  | { status: "ready"; body: EventCreateBody };

export type EventEditDecision =
  | { status: "blocked" }
  | { status: "invalid"; errors: EventFieldErrors }
  | { status: "unchanged" }
  | { status: "ready"; body: EventPatchBody };

export type EventView = {
  id: string;
  name: string;
  eventDate: string;
  occasion: string | null;
  notes: string | null;
  comfortNeeds: string[];
  lookId: string | null;
  lookName: string | null;
};

export type LookChoice = {
  id: string;
  name: string;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

/** Format YYYY-MM-DD from its parts. Do not parse the string with the local Date constructor. */
export function displayCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || !isCalendarDate(value)) return value;
  const month = MONTHS[Number(match[2]) - 1];
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

export function saveEventRequest(input: {
  pending: boolean;
  name: string;
  eventDate: string;
  occasion: string;
  notes: string;
  comfortText: string;
  lookId: string;
}): EventSaveDecision {
  if (input.pending) return { status: "blocked" };
  const errors = validateEventFields(input);
  if (Object.keys(errors).length > 0) return { status: "invalid", errors };
  const comfort = parseComfortNeeds(input.comfortText);
  const body: EventCreateBody = {
    name: input.name.trim(),
    event_date: input.eventDate,
  };
  const occasion = input.occasion.trim();
  const notes = input.notes.trim();
  if (occasion) body.occasion = occasion;
  if (notes) body.notes = notes;
  if (comfort.ok && comfort.values.length > 0) body.comfort_needs = comfort.values;
  const lookId = input.lookId.trim();
  if (lookId) body.look_id = lookId;
  return { status: "ready", body };
}

export function editEventRequest(input: {
  pending: boolean;
  original: EventView;
  name: string;
  eventDate: string;
  occasion: string;
  notes: string;
  comfortText: string;
  lookId: string;
}): EventEditDecision {
  if (input.pending) return { status: "blocked" };
  const errors = validateEventFields(input);
  if (Object.keys(errors).length > 0) return { status: "invalid", errors };
  const comfort = parseComfortNeeds(input.comfortText);
  if (!comfort.ok) return { status: "invalid", errors: { comfort_needs: comfort.error } };
  const body: EventPatchBody = {};
  const name = input.name.trim();
  if (name !== input.original.name) body.name = name;
  if (input.eventDate !== input.original.eventDate) body.event_date = input.eventDate;
  const occasion = input.occasion.trim();
  const nextOccasion = occasion.length > 0 ? occasion : null;
  if (nextOccasion !== input.original.occasion) body.occasion = nextOccasion;
  const notes = input.notes.trim();
  const nextNotes = notes.length > 0 ? notes : null;
  if (nextNotes !== input.original.notes) body.notes = nextNotes;
  if (!sameList(comfort.values, input.original.comfortNeeds)) body.comfort_needs = comfort.values;
  const lookId = input.lookId.trim();
  const nextLook = lookId.length > 0 ? lookId : null;
  if (nextLook !== input.original.lookId) body.look_id = nextLook;
  if (Object.keys(body).length === 0) return { status: "unchanged" };
  return { status: "ready", body };
}

function validateEventFields(input: {
  name: string;
  eventDate: string;
  occasion: string;
  notes: string;
  comfortText: string;
}): EventFieldErrors {
  const errors: EventFieldErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = "Name is required.";
  else if (name.length > EVENT_NAME_MAX) errors.name = "Name must be at most 100 characters.";
  if (!input.eventDate.trim()) errors.event_date = "Event date is required.";
  else if (!isCalendarDate(input.eventDate)) errors.event_date = "Event date must be a calendar date.";
  if (input.occasion.trim().length > EVENT_OCCASION_MAX) {
    errors.occasion = "Occasion must be at most 200 characters.";
  }
  if (input.notes.trim().length > EVENT_NOTES_MAX) {
    errors.notes = "Notes must be at most 1000 characters.";
  }
  const comfort = parseComfortNeeds(input.comfortText);
  if (!comfort.ok) errors.comfort_needs = comfort.error;
  return errors;
}

export function parseComfortNeeds(
  text: string,
): { ok: true; values: string[] } | { ok: false; error: string } {
  const values: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.length === 0) continue;
    const trimmed = line.trim();
    if (!trimmed) return { ok: false, error: "Each comfort need must not be blank." };
    if (trimmed.length > EVENT_COMFORT_MAX_LENGTH) {
      return { ok: false, error: "Each comfort need must be at most 200 characters." };
    }
    values.push(trimmed);
  }
  if (values.length > EVENT_COMFORT_MAX_ITEMS) {
    return { ok: false, error: "Comfort needs must contain at most 20 items." };
  }
  return { ok: true, values };
}

function sameList(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function readEventCreate(
  body: unknown,
): { ok: true; body: EventCreateBody } | { ok: false; status: 400 | 422; error: string; fields: EventFieldErrors } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request body.", fields: {} };
  }
  const record = body as Record<string, unknown>;
  if ("owner_id" in record || "latitude" in record || "location" in record) {
    return { ok: false, status: 422, error: "That field cannot be set by the client.", fields: {} };
  }
  const allowed = new Set(["name", "event_date", "occasion", "notes", "comfort_needs", "look_id"]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return { ok: false, status: 422, error: "That field cannot be set by the client.", fields: {} };
    }
  }
  if (typeof record.name !== "string" || typeof record.event_date !== "string") {
    return { ok: false, status: 422, error: "Name and event date are required.", fields: { name: "Name is required." } };
  }
  if (record.comfort_needs != null && !Array.isArray(record.comfort_needs)) {
    return {
      ok: false,
      status: 422,
      error: "Check the comfort needs and try again.",
      fields: { comfort_needs: "Comfort needs must be a list." },
    };
  }
  const comfortText = Array.isArray(record.comfort_needs)
    ? record.comfort_needs.map((item) => (typeof item === "string" ? item : " ")).join("\n")
    : "";
  const decision = saveEventRequest({
    pending: false,
    name: record.name,
    eventDate: record.event_date,
    occasion: typeof record.occasion === "string" ? record.occasion : "",
    notes: typeof record.notes === "string" ? record.notes : "",
    comfortText,
    lookId: typeof record.look_id === "string" ? record.look_id : "",
  });
  if (decision.status === "invalid") {
    return { ok: false, status: 422, error: "Check the highlighted fields and try again.", fields: decision.errors };
  }
  if (decision.status !== "ready") {
    return { ok: false, status: 400, error: "Invalid request body.", fields: {} };
  }
  return { ok: true, body: decision.body };
}

export function readEventPatch(
  body: unknown,
): { ok: true; body: EventPatchBody } | { ok: false; status: 400 | 422; error: string; fields: EventFieldErrors } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request body.", fields: {} };
  }
  const record = body as Record<string, unknown>;
  const allowed = new Set(["name", "event_date", "occasion", "notes", "comfort_needs", "look_id"]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return { ok: false, status: 422, error: "That field cannot be set by the client.", fields: {} };
    }
  }
  if (Object.keys(record).length === 0) {
    return { ok: false, status: 422, error: NO_EVENT_CHANGES, fields: {} };
  }
  if ("name" in record && (record.name === null || typeof record.name !== "string" || !record.name.trim())) {
    return { ok: false, status: 422, error: "Name is required.", fields: { name: "Name is required." } };
  }
  if ("event_date" in record && (record.event_date === null || typeof record.event_date !== "string" || !isCalendarDate(record.event_date))) {
    return {
      ok: false,
      status: 422,
      error: "Event date must be a calendar date.",
      fields: { event_date: "Event date must be a calendar date." },
    };
  }
  const bodyOut: EventPatchBody = {};
  if (typeof record.name === "string") bodyOut.name = record.name.trim();
  if (typeof record.event_date === "string") bodyOut.event_date = record.event_date;
  if ("occasion" in record) {
    bodyOut.occasion = typeof record.occasion === "string" && record.occasion.trim() ? record.occasion.trim() : null;
  }
  if ("notes" in record) {
    bodyOut.notes = typeof record.notes === "string" && record.notes.trim() ? record.notes.trim() : null;
  }
  if ("comfort_needs" in record) {
    if (!Array.isArray(record.comfort_needs)) {
      return {
        ok: false,
        status: 422,
        error: "Check the comfort needs and try again.",
        fields: { comfort_needs: "Comfort needs must be a list." },
      };
    }
    const parsed = parseComfortNeeds(record.comfort_needs.map((item) => (typeof item === "string" ? item : " ")).join("\n"));
    if (!parsed.ok) {
      return { ok: false, status: 422, error: parsed.error, fields: { comfort_needs: parsed.error } };
    }
    bodyOut.comfort_needs = parsed.values;
  }
  if ("look_id" in record) {
    if (record.look_id === null) bodyOut.look_id = null;
    else if (typeof record.look_id === "string" && record.look_id.trim()) bodyOut.look_id = record.look_id.trim();
    else {
      return { ok: false, status: 422, error: "Choose a saved look or none.", fields: { look_id: "Choose a saved look or none." } };
    }
  }
  if (Object.keys(bodyOut).length === 0) {
    return { ok: false, status: 422, error: NO_EVENT_CHANGES, fields: {} };
  }
  return { ok: true, body: bodyOut };
}

export function eventFromApi(data: unknown): EventView | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id.trim() || typeof record.name !== "string") return null;
  if (typeof record.event_date !== "string" || !isCalendarDate(record.event_date)) return null;
  const occasion = optionalText(record.occasion);
  const notes = optionalText(record.notes);
  const lookId = optionalText(record.look_id);
  const lookName = optionalText(record.look_name);
  if (occasion === undefined || notes === undefined || lookId === undefined || lookName === undefined) return null;
  if (!Array.isArray(record.comfort_needs) || record.comfort_needs.some((item) => typeof item !== "string")) return null;
  return {
    id: record.id,
    name: record.name,
    eventDate: record.event_date,
    occasion,
    notes,
    comfortNeeds: record.comfort_needs,
    lookId,
    lookName,
  };
}

function optionalText(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value;
  return undefined;
}

export function eventsFromApi(data: unknown): EventView[] | null {
  if (!Array.isArray(data)) return null;
  const events: EventView[] = [];
  for (const item of data) {
    const event = eventFromApi(item);
    if (!event) return null;
    events.push(event);
  }
  return events;
}

export function lookChoicesFromApi(data: unknown): LookChoice[] | null {
  if (!Array.isArray(data)) return null;
  const choices: LookChoice[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id.trim() || typeof record.name !== "string") return null;
    choices.push({ id: record.id, name: record.name });
  }
  return choices;
}
