export const STYLING_PREFERENCES = ["men", "women", "unisex"] as const;
export type StylingPreference = (typeof STYLING_PREFERENCES)[number];

export const PREFERRED_STYLES = ["Indian", "Western", "fusion"] as const;
export type PreferredStyle = (typeof PREFERRED_STYLES)[number];

export type ProfilePayload = {
  styling_preference: StylingPreference;
  preferred_styles: PreferredStyle[];
  preferred_colors: string[];
  fit_preferences: string[];
  comfort_preferences: string[];
  clothing_to_avoid: string[];
};

export type ProfilePublic = ProfilePayload & {
  owner_id: string;
};

export const EMPTY_PROFILE: ProfilePayload = {
  styling_preference: "unisex",
  preferred_styles: [],
  preferred_colors: [],
  fit_preferences: [],
  comfort_preferences: [],
  clothing_to_avoid: [],
};

export function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function listToLines(values: string[]): string {
  return values.join("\n");
}

export function isPreferredStyle(value: string): value is PreferredStyle {
  return (PREFERRED_STYLES as readonly string[]).includes(value);
}

export function isStylingPreference(value: string): value is StylingPreference {
  return (STYLING_PREFERENCES as readonly string[]).includes(value);
}
