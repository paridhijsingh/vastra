import { describe, expect, it } from "vitest";

import {
  EMPTY_PROFILE_FORM,
  PROFILE_CREATED_MESSAGE,
  STYLING_PREFERENCE_REQUIRED_MESSAGE,
  draftFromProfile,
  toProfilePayload,
  type ProfilePublic,
} from "@/lib/profile/types";

const SAVED: ProfilePublic = {
  owner_id: "user-1",
  styling_preference: "women",
  preferred_styles: ["Indian"],
  preferred_colors: ["navy"],
  fit_preferences: ["tailored"],
  comfort_preferences: [],
  clothing_to_avoid: ["stilettos"],
};

describe("new profile styling preference", () => {
  it("starts with a placeholder instead of unisex", () => {
    const draft = draftFromProfile(null);
    expect(draft.styling_preference).toBe("");
    expect(EMPTY_PROFILE_FORM.styling_preference).toBe("");
    expect(draft.styling_preference).not.toBe("unisex");
  });

  it("requires an explicit choice before saving", () => {
    expect(toProfilePayload(draftFromProfile(null))).toBeNull();
    expect(STYLING_PREFERENCE_REQUIRED_MESSAGE).toMatch(/styling preference/i);
  });

  it("preserves a saved preference when loading an existing profile", () => {
    const draft = draftFromProfile(SAVED);
    expect(draft.styling_preference).toBe("women");
    expect(draft.preferred_styles).toEqual(["Indian"]);
    const payload = toProfilePayload(draft);
    expect(payload?.styling_preference).toBe("women");
    expect(payload?.preferred_colors).toEqual(["navy"]);
  });

  it("resets to the placeholder after deletion", () => {
    const afterDelete = draftFromProfile(null);
    expect(afterDelete.styling_preference).toBe("");
    expect(afterDelete.preferred_styles).toEqual([]);
  });

  it("uses the create-success copy that points people to the wardrobe", () => {
    expect(PROFILE_CREATED_MESSAGE).toContain("style profile is saved");
    expect(PROFILE_CREATED_MESSAGE).toContain("clothes you own");
  });
});
