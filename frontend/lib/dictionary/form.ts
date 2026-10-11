import {
  DICTIONARY_KINDS,
  DICTIONARY_STYLES,
  isDictionaryKind,
  isDictionaryStyle,
  type DictionaryEntry,
  type DictionaryKind,
  type DictionaryStyle,
} from "@/lib/dictionary/types";

export const DICTIONARY_TERM_MAX = 80;
export const DICTIONARY_DEFINITION_MAX = 600;
export const DICTIONARY_CONTEXT_MAX = 200;
export const DICTIONARY_SHORT_ITEM_MAX = 64;
export const DICTIONARY_NOTE_MAX = 280;
export const DICTIONARY_SHORT_LIST_MAX = 16;
export const DICTIONARY_NOTE_LIST_MAX = 12;
export const DICTIONARY_STYLE_LIST_MAX = 3;

const CREATE_FIELDS = [
  "term",
  "definition",
  "kind",
  "aliases",
  "styles",
  "style_tags",
  "cultural_context",
  "pairing_suggestions",
  "occasions",
  "weather_notes",
  "comfort_notes",
  "guidance_type",
] as const;

const PATCH_FIELDS = [
  "term",
  "definition",
  "kind",
  "aliases",
  "styles",
  "style_tags",
  "cultural_context",
  "pairing_suggestions",
  "occasions",
  "weather_notes",
  "comfort_notes",
] as const;

const FORBIDDEN_CLIENT_FIELDS = ["id", "owner_id", "origin"] as const;

export type DictionaryFormValues = {
  term: string;
  definition: string;
  kind: DictionaryKind | "";
  aliases: string;
  styles: DictionaryStyle[];
  styleTags: string;
  culturalContext: string;
  pairingSuggestions: string;
  occasions: string;
  weatherNotes: string;
  comfortNotes: string;
};

export type DictionaryFieldErrors = Partial<Record<keyof DictionaryFormValues, string>>;

export type DictionaryCreatePayload = {
  term: string;
  definition: string;
  kind: DictionaryKind;
  aliases: string[];
  styles: DictionaryStyle[];
  style_tags: string[];
  cultural_context: string | null;
  pairing_suggestions: string[];
  occasions: string[];
  weather_notes: string[];
  comfort_notes: string[];
  guidance_type: "general";
};

export type DictionaryPatchPayload = {
  term?: string;
  definition?: string;
  kind?: DictionaryKind;
  aliases?: string[];
  styles?: DictionaryStyle[];
  style_tags?: string[];
  cultural_context?: string | null;
  pairing_suggestions?: string[];
  occasions?: string[];
  weather_notes?: string[];
  comfort_notes?: string[];
};

export const EMPTY_DICTIONARY_FORM: DictionaryFormValues = {
  term: "",
  definition: "",
  kind: "",
  aliases: "",
  styles: [],
  styleTags: "",
  culturalContext: "",
  pairingSuggestions: "",
  occasions: "",
  weatherNotes: "",
  comfortNotes: "",
};

type NormalizedEntry = {
  term: string;
  definition: string;
  kind: DictionaryKind;
  aliases: string[];
  styles: DictionaryStyle[];
  styleTags: string[];
  culturalContext: string | null;
  pairingSuggestions: string[];
  occasions: string[];
  weatherNotes: string[];
  comfortNotes: string[];
};

export function canManageDictionaryEntry(entry: { origin: DictionaryEntry["origin"] }): boolean {
  return entry.origin === "personal";
}

export function deleteConfirmationLabel(term: string): string {
  return `Delete ${term}?`;
}

export function entryToForm(entry: DictionaryEntry): DictionaryFormValues {
  return {
    term: entry.term,
    definition: entry.definition,
    kind: entry.kind,
    aliases: entry.aliases.join("\n"),
    styles: orderedStyles(entry.styles),
    styleTags: entry.style_tags.join("\n"),
    culturalContext: entry.cultural_context ?? "",
    pairingSuggestions: entry.pairing_suggestions.join("\n"),
    occasions: entry.occasions.join("\n"),
    weatherNotes: entry.weather_notes.join("\n"),
    comfortNotes: entry.comfort_notes.join("\n"),
  };
}

export function submitDictionaryForm(
  values: DictionaryFormValues,
  original?: DictionaryEntry | null,
):
  | { ok: false; fields: DictionaryFieldErrors }
  | { ok: true; mode: "create"; body: DictionaryCreatePayload }
  | { ok: true; mode: "edit"; patch: DictionaryPatchPayload | null } {
  const parsed = normalizeForm(values);
  if (!parsed.ok) {
    return { ok: false, fields: parsed.fields };
  }
  if (!original) {
    return { ok: true, mode: "create", body: toCreatePayload(parsed.value) };
  }
  return { ok: true, mode: "edit", patch: toPatchPayload(original, parsed.value) };
}

export function readDictionaryCreateBody(
  body: unknown,
): { ok: true; body: DictionaryCreatePayload } | { ok: false; error: string; fields: DictionaryFieldErrors } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body.", fields: {} };
  }
  const record = body as Record<string, unknown>;
  const forbidden = forbiddenFieldError(record);
  if (forbidden) return forbidden;
  const unexpected = unexpectedFieldError(record, CREATE_FIELDS);
  if (unexpected) return unexpected;
  if ("guidance_type" in record && record.guidance_type !== "general") {
    return { ok: false, error: "guidance_type must be general.", fields: {} };
  }

  const fields: DictionaryFieldErrors = {};
  const term = requiredText(record.term, "Term", DICTIONARY_TERM_MAX, fields, "term");
  const definition = requiredText(
    record.definition,
    "Definition",
    DICTIONARY_DEFINITION_MAX,
    fields,
    "definition",
  );
  const kind = requiredKind(record.kind, fields);
  const aliases = jsonList(
    record.aliases ?? [],
    { maxItems: DICTIONARY_SHORT_LIST_MAX, maxLength: DICTIONARY_SHORT_ITEM_MAX, label: "Aliases" },
    fields,
    "aliases",
  );
  const styles = jsonStyles(record.styles ?? [], fields);
  const styleTags = jsonList(
    record.style_tags ?? [],
    {
      maxItems: DICTIONARY_SHORT_LIST_MAX,
      maxLength: DICTIONARY_SHORT_ITEM_MAX,
      label: "Cultural or style tags",
    },
    fields,
    "styleTags",
  );
  const culturalContext = jsonContext(record.cultural_context, fields);
  const pairing = jsonList(
    record.pairing_suggestions ?? [],
    { maxItems: DICTIONARY_NOTE_LIST_MAX, maxLength: DICTIONARY_NOTE_MAX, label: "Pairing suggestions" },
    fields,
    "pairingSuggestions",
  );
  const occasions = jsonList(
    record.occasions ?? [],
    { maxItems: DICTIONARY_SHORT_LIST_MAX, maxLength: DICTIONARY_SHORT_ITEM_MAX, label: "Occasions" },
    fields,
    "occasions",
  );
  const weather = jsonList(
    record.weather_notes ?? [],
    { maxItems: DICTIONARY_NOTE_LIST_MAX, maxLength: DICTIONARY_NOTE_MAX, label: "Weather notes" },
    fields,
    "weatherNotes",
  );
  const comfort = jsonList(
    record.comfort_notes ?? [],
    { maxItems: DICTIONARY_NOTE_LIST_MAX, maxLength: DICTIONARY_NOTE_MAX, label: "Comfort notes" },
    fields,
    "comfortNotes",
  );

  if (Object.keys(fields).length > 0 || !term || !definition || !kind) {
    return { ok: false, error: "Check the highlighted fields and try again.", fields };
  }
  if (!aliases || !styles || !styleTags || !pairing || !occasions || !weather || !comfort) {
    return { ok: false, error: "Check the highlighted fields and try again.", fields };
  }
  if (culturalContext === undefined) {
    return { ok: false, error: "Check the highlighted fields and try again.", fields };
  }

  return {
    ok: true,
    body: {
      term,
      definition,
      kind,
      aliases,
      styles,
      style_tags: styleTags,
      cultural_context: culturalContext,
      pairing_suggestions: pairing,
      occasions,
      weather_notes: weather,
      comfort_notes: comfort,
      guidance_type: "general",
    },
  };
}

export function readDictionaryPatchBody(
  body: unknown,
): { ok: true; body: DictionaryPatchPayload } | { ok: false; error: string; fields: DictionaryFieldErrors } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body.", fields: {} };
  }
  const record = body as Record<string, unknown>;
  const forbidden = forbiddenFieldError(record);
  if (forbidden) return forbidden;
  const unexpected = unexpectedFieldError(record, PATCH_FIELDS);
  if (unexpected) return unexpected;
  if (Object.keys(record).length === 0) {
    return { ok: false, error: "At least one field is required.", fields: {} };
  }

  const fields: DictionaryFieldErrors = {};
  const patch: DictionaryPatchPayload = {};

  if ("term" in record) {
    const term = requiredText(record.term, "Term", DICTIONARY_TERM_MAX, fields, "term");
    if (term) patch.term = term;
  }
  if ("definition" in record) {
    const definition = requiredText(
      record.definition,
      "Definition",
      DICTIONARY_DEFINITION_MAX,
      fields,
      "definition",
    );
    if (definition) patch.definition = definition;
  }
  if ("kind" in record) {
    const kind = requiredKind(record.kind, fields);
    if (kind) patch.kind = kind;
  }
  if ("aliases" in record) {
    const aliases = jsonList(
      record.aliases,
      { maxItems: DICTIONARY_SHORT_LIST_MAX, maxLength: DICTIONARY_SHORT_ITEM_MAX, label: "Aliases" },
      fields,
      "aliases",
    );
    if (aliases) patch.aliases = aliases;
  }
  if ("styles" in record) {
    const styles = jsonStyles(record.styles, fields);
    if (styles) patch.styles = styles;
  }
  if ("style_tags" in record) {
    const styleTags = jsonList(
      record.style_tags,
      {
        maxItems: DICTIONARY_SHORT_LIST_MAX,
        maxLength: DICTIONARY_SHORT_ITEM_MAX,
        label: "Cultural or style tags",
      },
      fields,
      "styleTags",
    );
    if (styleTags) patch.style_tags = styleTags;
  }
  if ("cultural_context" in record) {
    const culturalContext = jsonContext(record.cultural_context, fields);
    if (culturalContext !== undefined) patch.cultural_context = culturalContext;
  }
  if ("pairing_suggestions" in record) {
    const pairing = jsonList(
      record.pairing_suggestions,
      { maxItems: DICTIONARY_NOTE_LIST_MAX, maxLength: DICTIONARY_NOTE_MAX, label: "Pairing suggestions" },
      fields,
      "pairingSuggestions",
    );
    if (pairing) patch.pairing_suggestions = pairing;
  }
  if ("occasions" in record) {
    const occasions = jsonList(
      record.occasions,
      { maxItems: DICTIONARY_SHORT_LIST_MAX, maxLength: DICTIONARY_SHORT_ITEM_MAX, label: "Occasions" },
      fields,
      "occasions",
    );
    if (occasions) patch.occasions = occasions;
  }
  if ("weather_notes" in record) {
    const weather = jsonList(
      record.weather_notes,
      { maxItems: DICTIONARY_NOTE_LIST_MAX, maxLength: DICTIONARY_NOTE_MAX, label: "Weather notes" },
      fields,
      "weatherNotes",
    );
    if (weather) patch.weather_notes = weather;
  }
  if ("comfort_notes" in record) {
    const comfort = jsonList(
      record.comfort_notes,
      { maxItems: DICTIONARY_NOTE_LIST_MAX, maxLength: DICTIONARY_NOTE_MAX, label: "Comfort notes" },
      fields,
      "comfortNotes",
    );
    if (comfort) patch.comfort_notes = comfort;
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, error: "Check the highlighted fields and try again.", fields };
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "At least one field is required.", fields: {} };
  }
  return { ok: true, body: patch };
}

export function fieldErrorsFromApiDetail(detail: unknown): DictionaryFieldErrors {
  if (!Array.isArray(detail)) return {};
  const fields: DictionaryFieldErrors = {};
  for (const item of detail) {
    if (!item || typeof item !== "object" || !("loc" in item) || !("msg" in item)) continue;
    const loc = (item as { loc: unknown }).loc;
    if (!Array.isArray(loc)) continue;
    const key = loc.find((part) => part !== "body" && typeof part === "string");
    if (typeof key !== "string") continue;
    const field = apiFieldName(key);
    if (!field || fields[field]) continue;
    fields[field] = String((item as { msg: unknown }).msg);
  }
  return fields;
}

function apiFieldName(key: string): keyof DictionaryFormValues | null {
  switch (key) {
    case "term":
    case "definition":
    case "kind":
    case "aliases":
    case "styles":
    case "occasions":
      return key;
    case "style_tags":
      return "styleTags";
    case "cultural_context":
      return "culturalContext";
    case "pairing_suggestions":
      return "pairingSuggestions";
    case "weather_notes":
      return "weatherNotes";
    case "comfort_notes":
      return "comfortNotes";
    default:
      return null;
  }
}

function forbiddenFieldError(
  record: Record<string, unknown>,
): { ok: false; error: string; fields: DictionaryFieldErrors } | null {
  for (const field of FORBIDDEN_CLIENT_FIELDS) {
    if (field in record) {
      return {
        ok: false,
        error: "Id, ownership, and origin cannot be set by the client.",
        fields: {},
      };
    }
  }
  return null;
}

function unexpectedFieldError(
  record: Record<string, unknown>,
  allowed: readonly string[],
): { ok: false; error: string; fields: DictionaryFieldErrors } | null {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      return { ok: false, error: "Unexpected field.", fields: {} };
    }
  }
  return null;
}

function normalizeForm(
  values: DictionaryFormValues,
): { ok: true; value: NormalizedEntry } | { ok: false; fields: DictionaryFieldErrors } {
  const fields: DictionaryFieldErrors = {};
  const term = boundedText(values.term, "Term", DICTIONARY_TERM_MAX, true, fields, "term");
  const definition = boundedText(
    values.definition,
    "Definition",
    DICTIONARY_DEFINITION_MAX,
    true,
    fields,
    "definition",
  );
  let kind: DictionaryKind | "" = "";
  if (!values.kind) {
    fields.kind = "Choose a type.";
  } else if (!isDictionaryKind(values.kind) || !DICTIONARY_KINDS.includes(values.kind)) {
    fields.kind = "Choose a supported type.";
  } else {
    kind = values.kind;
  }

  const aliases = linesField(
    values.aliases,
    { maxItems: DICTIONARY_SHORT_LIST_MAX, maxLength: DICTIONARY_SHORT_ITEM_MAX, label: "Aliases" },
    fields,
    "aliases",
  );
  const styleTags = linesField(
    values.styleTags,
    {
      maxItems: DICTIONARY_SHORT_LIST_MAX,
      maxLength: DICTIONARY_SHORT_ITEM_MAX,
      label: "Cultural or style tags",
    },
    fields,
    "styleTags",
  );
  const pairingSuggestions = linesField(
    values.pairingSuggestions,
    { maxItems: DICTIONARY_NOTE_LIST_MAX, maxLength: DICTIONARY_NOTE_MAX, label: "Pairing suggestions" },
    fields,
    "pairingSuggestions",
  );
  const occasions = linesField(
    values.occasions,
    { maxItems: DICTIONARY_SHORT_LIST_MAX, maxLength: DICTIONARY_SHORT_ITEM_MAX, label: "Occasions" },
    fields,
    "occasions",
  );
  const weatherNotes = linesField(
    values.weatherNotes,
    { maxItems: DICTIONARY_NOTE_LIST_MAX, maxLength: DICTIONARY_NOTE_MAX, label: "Weather notes" },
    fields,
    "weatherNotes",
  );
  const comfortNotes = linesField(
    values.comfortNotes,
    { maxItems: DICTIONARY_NOTE_LIST_MAX, maxLength: DICTIONARY_NOTE_MAX, label: "Comfort notes" },
    fields,
    "comfortNotes",
  );
  const culturalContext = boundedText(
    values.culturalContext,
    "Cultural context",
    DICTIONARY_CONTEXT_MAX,
    false,
    fields,
    "culturalContext",
  );
  const styles = normalizeStyles(values.styles, fields);

  if (
    Object.keys(fields).length > 0 ||
    term === undefined ||
    definition === undefined ||
    !kind ||
    !aliases ||
    !styleTags ||
    !pairingSuggestions ||
    !occasions ||
    !weatherNotes ||
    !comfortNotes ||
    culturalContext === undefined ||
    !styles
  ) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    value: {
      term,
      definition,
      kind,
      aliases,
      styles,
      styleTags,
      culturalContext: culturalContext || null,
      pairingSuggestions,
      occasions,
      weatherNotes,
      comfortNotes,
    },
  };
}

function toCreatePayload(value: NormalizedEntry): DictionaryCreatePayload {
  return {
    term: value.term,
    definition: value.definition,
    kind: value.kind,
    aliases: value.aliases,
    styles: value.styles,
    style_tags: value.styleTags,
    cultural_context: value.culturalContext,
    pairing_suggestions: value.pairingSuggestions,
    occasions: value.occasions,
    weather_notes: value.weatherNotes,
    comfort_notes: value.comfortNotes,
    guidance_type: "general",
  };
}

function toPatchPayload(original: DictionaryEntry, value: NormalizedEntry): DictionaryPatchPayload | null {
  const patch: DictionaryPatchPayload = {};
  if (value.term !== original.term) patch.term = value.term;
  if (value.definition !== original.definition) patch.definition = value.definition;
  if (value.kind !== original.kind) patch.kind = value.kind;
  if (!sameList(value.aliases, original.aliases)) patch.aliases = value.aliases;
  if (!sameList(value.styles, orderedStyles(original.styles))) patch.styles = value.styles;
  if (!sameList(value.styleTags, original.style_tags)) patch.style_tags = value.styleTags;
  if (value.culturalContext !== (original.cultural_context ?? null)) {
    patch.cultural_context = value.culturalContext;
  }
  if (!sameList(value.pairingSuggestions, original.pairing_suggestions)) {
    patch.pairing_suggestions = value.pairingSuggestions;
  }
  if (!sameList(value.occasions, original.occasions)) patch.occasions = value.occasions;
  if (!sameList(value.weatherNotes, original.weather_notes)) patch.weather_notes = value.weatherNotes;
  if (!sameList(value.comfortNotes, original.comfort_notes)) patch.comfort_notes = value.comfortNotes;
  return Object.keys(patch).length > 0 ? patch : null;
}

function orderedStyles(styles: readonly string[]): DictionaryStyle[] {
  return DICTIONARY_STYLES.filter((style) => styles.includes(style));
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function boundedText(
  value: string,
  label: string,
  maxLength: number,
  required: boolean,
  fields: DictionaryFieldErrors,
  key: keyof DictionaryFormValues,
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) fields[key] = `${label} is required.`;
    return required ? undefined : "";
  }
  if (trimmed.length > maxLength) {
    fields[key] = `${label} must be at most ${maxLength} characters.`;
    return undefined;
  }
  return trimmed;
}

function linesField(
  value: string,
  limits: { maxItems: number; maxLength: number; label: string },
  fields: DictionaryFieldErrors,
  key: keyof DictionaryFormValues,
): string[] | undefined {
  const items: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    if (line.length === 0) continue;
    const trimmed = line.trim();
    if (!trimmed) {
      fields[key] = `${limits.label}: remove blank lines.`;
      return undefined;
    }
    if (trimmed.length > limits.maxLength) {
      fields[key] = `${limits.label}: each line must be at most ${limits.maxLength} characters.`;
      return undefined;
    }
    items.push(trimmed);
  }
  if (items.length > limits.maxItems) {
    fields[key] = `${limits.label}: enter at most ${limits.maxItems} lines.`;
    return undefined;
  }
  return items;
}

function normalizeStyles(
  styles: readonly string[],
  fields: DictionaryFieldErrors,
): DictionaryStyle[] | undefined {
  if (styles.length > DICTIONARY_STYLE_LIST_MAX) {
    fields.styles = "Choose at most 3 broad styles.";
    return undefined;
  }
  const selected: DictionaryStyle[] = [];
  for (const style of styles) {
    if (!isDictionaryStyle(style)) {
      fields.styles = "Broad styles must be Indian, Western, or fusion.";
      return undefined;
    }
    if (!selected.includes(style)) selected.push(style);
  }
  return orderedStyles(selected);
}

function requiredText(
  value: unknown,
  label: string,
  maxLength: number,
  fields: DictionaryFieldErrors,
  key: keyof DictionaryFormValues,
): string | undefined {
  if (value === null) {
    fields[key] = `${label} must not be null.`;
    return undefined;
  }
  if (typeof value !== "string") {
    fields[key] = `${label} is required.`;
    return undefined;
  }
  return boundedText(value, label, maxLength, true, fields, key);
}

function requiredKind(value: unknown, fields: DictionaryFieldErrors): DictionaryKind | undefined {
  if (value === null) {
    fields.kind = "Type must not be null.";
    return undefined;
  }
  if (typeof value !== "string" || !isDictionaryKind(value)) {
    fields.kind = "Choose a type.";
    return undefined;
  }
  return value;
}

function jsonList(
  value: unknown,
  limits: { maxItems: number; maxLength: number; label: string },
  fields: DictionaryFieldErrors,
  key: keyof DictionaryFormValues,
): string[] | undefined {
  if (value === null) {
    fields[key] = `${limits.label} must not be null.`;
    return undefined;
  }
  if (!Array.isArray(value)) {
    fields[key] = `${limits.label} must be a list.`;
    return undefined;
  }
  if (value.length > limits.maxItems) {
    fields[key] = `${limits.label}: enter at most ${limits.maxItems} lines.`;
    return undefined;
  }
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      fields[key] = `${limits.label}: remove blank lines.`;
      return undefined;
    }
    const trimmed = item.trim();
    if (trimmed.length > limits.maxLength) {
      fields[key] = `${limits.label}: each line must be at most ${limits.maxLength} characters.`;
      return undefined;
    }
    items.push(trimmed);
  }
  return items;
}

function jsonStyles(value: unknown, fields: DictionaryFieldErrors): DictionaryStyle[] | undefined {
  if (value === null) {
    fields.styles = "Broad styles must not be null.";
    return undefined;
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    fields.styles = "Broad styles must be a list.";
    return undefined;
  }
  return normalizeStyles(value, fields);
}

function jsonContext(
  value: unknown,
  fields: DictionaryFieldErrors,
): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    fields.culturalContext = "Cultural context must be text.";
    return undefined;
  }
  const trimmed = boundedText(
    value,
    "Cultural context",
    DICTIONARY_CONTEXT_MAX,
    false,
    fields,
    "culturalContext",
  );
  if (trimmed === undefined) return undefined;
  return trimmed || null;
}
