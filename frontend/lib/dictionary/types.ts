/** Style filter values accepted by GET /dictionary. Not the broader style_tags list. */
export const DICTIONARY_STYLES = ["Indian", "Western", "fusion"] as const;
export type DictionaryStyle = (typeof DICTIONARY_STYLES)[number];

export const DICTIONARY_KINDS = [
  "garment",
  "fabric",
  "silhouette",
  "styling_technique",
] as const;
export type DictionaryKind = (typeof DICTIONARY_KINDS)[number];

export const DICTIONARY_KIND_LABELS: Record<DictionaryKind, string> = {
  garment: "Garment",
  fabric: "Fabric",
  silhouette: "Silhouette",
  styling_technique: "Styling technique",
};

export const STYLE_FILTER_LIMITATION =
  "The style filter matches Indian, Western, and fusion only. Entries may include other cultural style tags, which are not separate filters yet.";

export const EMPTY_DICTIONARY_TITLE = "No dictionary entries yet.";
export const EMPTY_DICTIONARY_BODY =
  "Fashion terms and styling guidance will appear here as the collection grows.";
export const NO_MATCH_TITLE = "No matching terms.";
export const MISSING_ENTRY_TITLE = "Term not found";
export const MISSING_ENTRY_BODY = "That dictionary entry does not exist.";
export const DICTIONARY_LOAD_ERROR =
  "Could not load the dictionary. Please try again.";

export type DictionaryFilters = {
  q: string;
  style: DictionaryStyle | "";
  kind: DictionaryKind | "";
};

export const EMPTY_DICTIONARY_FILTERS: DictionaryFilters = {
  q: "",
  style: "",
  kind: "",
};

export type DictionaryEntry = {
  id: string;
  term: string;
  aliases: string[];
  definition: string;
  kind: DictionaryKind;
  styles: DictionaryStyle[];
  style_tags: string[];
  cultural_context: string | null;
  pairing_suggestions: string[];
  occasions: string[];
  weather_notes: string[];
  comfort_notes: string[];
  guidance_type: "general";
};

export function isDictionaryStyle(value: string): value is DictionaryStyle {
  return (DICTIONARY_STYLES as readonly string[]).includes(value);
}

export function isDictionaryKind(value: string): value is DictionaryKind {
  return (DICTIONARY_KINDS as readonly string[]).includes(value);
}

export function hasActiveDictionaryFilters(filters: DictionaryFilters): boolean {
  return Boolean(filters.q.trim() || filters.style || filters.kind);
}

/** URL for submitted filters. All styles and All types omit those parameters. */
export function dictionaryListHref(filters: DictionaryFilters): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q) params.set("q", q);
  if (filters.style) params.set("style", filters.style);
  if (filters.kind) params.set("kind", filters.kind);
  const query = params.toString();
  return query ? `/dictionary?${query}` : "/dictionary";
}

type RawSearch = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function filtersFromSearchParams(params: RawSearch): {
  filters: DictionaryFilters;
  unsupportedStyle: string | null;
  unsupportedKind: string | null;
} {
  const q = firstParam(params.q);
  const styleRaw = firstParam(params.style).trim();
  const kindRaw = firstParam(params.kind).trim();

  let style: DictionaryStyle | "" = "";
  let unsupportedStyle: string | null = null;
  if (styleRaw) {
    if (isDictionaryStyle(styleRaw)) {
      style = styleRaw;
    } else {
      unsupportedStyle = styleRaw;
    }
  }

  let kind: DictionaryKind | "" = "";
  let unsupportedKind: string | null = null;
  if (kindRaw) {
    if (isDictionaryKind(kindRaw)) {
      kind = kindRaw;
    } else {
      unsupportedKind = kindRaw;
    }
  }

  return {
    filters: { q, style, kind },
    unsupportedStyle,
    unsupportedKind,
  };
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === "string")) return null;
  return value;
}

export function parseDictionaryEntry(value: unknown): DictionaryEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.term !== "string") return null;
  if (typeof record.definition !== "string") return null;
  if (typeof record.kind !== "string" || !isDictionaryKind(record.kind)) return null;
  if (record.guidance_type !== "general") return null;
  const aliases = stringList(record.aliases);
  const styles = stringList(record.styles);
  const styleTags = stringList(record.style_tags);
  const pairing = stringList(record.pairing_suggestions);
  const occasions = stringList(record.occasions);
  const weather = stringList(record.weather_notes);
  const comfort = stringList(record.comfort_notes);
  if (!aliases || !styles || !styleTags || !pairing || !occasions || !weather || !comfort) {
    return null;
  }
  if (!styles.every((style) => isDictionaryStyle(style))) return null;
  const context = record.cultural_context;
  if (context !== null && typeof context !== "string") return null;
  return {
    id: record.id,
    term: record.term,
    aliases,
    definition: record.definition,
    kind: record.kind,
    styles,
    style_tags: styleTags,
    cultural_context: context,
    pairing_suggestions: pairing,
    occasions,
    weather_notes: weather,
    comfort_notes: comfort,
    guidance_type: "general",
  };
}

export function parseDictionaryList(value: unknown): DictionaryEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries: DictionaryEntry[] = [];
  for (const item of value) {
    const entry = parseDictionaryEntry(item);
    if (!entry) return null;
    entries.push(entry);
  }
  return entries;
}
