export const PREFERENCE_STATEMENT_MAX = 280;
export const PREFERENCE_OCCASION_MAX = 120;

export const TOPICS = ["comfort", "avoid", "style", "fit", "color", "occasion"] as const;
export type PreferenceTopic = (typeof TOPICS)[number];

export const TOPIC_LABELS: Record<PreferenceTopic, string> = {
  comfort: "Comfort",
  avoid: "Avoid",
  style: "Style",
  fit: "Fit",
  color: "Color",
  occasion: "Occasion",
};

export type PreferenceDraft = {
  topic: PreferenceTopic;
  statement: string;
  occasion: string;
};

export type PreferenceView = PreferenceDraft & {
  id: string;
};

export type PreferenceField = "topic" | "statement" | "occasion";
export type PreferenceFieldErrors = Partial<Record<PreferenceField, string>>;

export type ReviewDecision =
  | { status: "invalid"; errors: PreferenceFieldErrors }
  | { status: "ready"; body: { topic: PreferenceTopic; statement: string; occasion?: string } };

export function isTopic(value: string): value is PreferenceTopic {
  return (TOPICS as readonly string[]).includes(value);
}

export function reviewPreference(draft: PreferenceDraft): ReviewDecision {
  const errors: PreferenceFieldErrors = {};
  if (!isTopic(draft.topic)) errors.topic = "Choose a topic.";
  const statement = draft.statement.trim();
  if (!statement) errors.statement = "Write the preference.";
  else if (statement.length > PREFERENCE_STATEMENT_MAX) errors.statement = "Use at most 280 characters.";
  const occasion = draft.occasion.trim();
  if (occasion.length > PREFERENCE_OCCASION_MAX) errors.occasion = "Use at most 120 characters.";
  if (Object.keys(errors).length > 0 || !isTopic(draft.topic)) return { status: "invalid", errors };
  const body: { topic: PreferenceTopic; statement: string; occasion?: string } = {
    topic: draft.topic,
    statement,
  };
  if (occasion) body.occasion = occasion;
  return { status: "ready", body };
}

export function preferenceFromApi(value: unknown): PreferenceView | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id) return null;
  if (typeof record.topic !== "string" || !isTopic(record.topic)) return null;
  if (typeof record.statement !== "string" || !record.statement.trim()) return null;
  return {
    id: record.id,
    topic: record.topic,
    statement: record.statement.trim(),
    occasion: typeof record.occasion === "string" ? record.occasion : "",
  };
}
