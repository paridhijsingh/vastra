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

/** New or deleted profiles start with no styling preference selected. */
export type ProfileFormDraft = Omit<ProfilePayload, "styling_preference"> & {
  styling_preference: StylingPreference | "";
};

export const EMPTY_PROFILE_FORM: ProfileFormDraft = {
  styling_preference: "",
  preferred_styles: [],
  preferred_colors: [],
  fit_preferences: [],
  comfort_preferences: [],
  clothing_to_avoid: [],
};

export const PROFILE_CREATED_MESSAGE =
  "Your style profile is saved. Now add the clothes you own so Vastra can use them for outfit recommendations.";

export const STYLING_PREFERENCE_REQUIRED_MESSAGE =
  "Choose a styling preference before saving.";

/**
 * Offer the wardrobe step after a profile exists and no clothes are saved.
 * A null count means the wardrobe could not be checked; still offer the step.
 */
export function offerWardrobeNext(
  profileExists: boolean,
  wardrobeItemCount: number | null,
): boolean {
  if (!profileExists) return false;
  if (wardrobeItemCount === null) return true;
  return wardrobeItemCount === 0;
}

export function draftFromProfile(profile: ProfilePublic | null): ProfileFormDraft {
  if (!profile) {
    return {
      styling_preference: "",
      preferred_styles: [],
      preferred_colors: [],
      fit_preferences: [],
      comfort_preferences: [],
      clothing_to_avoid: [],
    };
  }
  return {
    styling_preference: profile.styling_preference,
    preferred_styles: [...profile.preferred_styles],
    preferred_colors: [...profile.preferred_colors],
    fit_preferences: [...profile.fit_preferences],
    comfort_preferences: [...profile.comfort_preferences],
    clothing_to_avoid: [...profile.clothing_to_avoid],
  };
}

/** Returns a save payload only after the user picks men, women, or unisex. */
export function toProfilePayload(draft: ProfileFormDraft): ProfilePayload | null {
  if (!isStylingPreference(draft.styling_preference)) {
    return null;
  }
  return {
    styling_preference: draft.styling_preference,
    preferred_styles: [...draft.preferred_styles],
    preferred_colors: [...draft.preferred_colors],
    fit_preferences: [...draft.fit_preferences],
    comfort_preferences: [...draft.comfort_preferences],
    clothing_to_avoid: [...draft.clothing_to_avoid],
  };
}

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
