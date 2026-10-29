import { describe, expect, it } from "vitest";

import {
  ADD_AVAILABLE_ITEM_MESSAGE,
  ASKING_NEMOTRON_MESSAGE,
  MODEL_UNAVAILABLE_MESSAGE,
  generateFailureMessage,
  garmentWhyLine,
  incompleteOutfitNote,
} from "@/lib/ai";
import { CREATING_OUTFIT_MESSAGE, NO_AVAILABLE_ITEMS_MESSAGE } from "@/lib/emergency/form";
import { EMPTY_WARDROBE_MESSAGE, FINDING_REPLACEMENT_MESSAGE } from "@/lib/rescue/form";

describe("AI result copy", () => {
  it("uses honest generate and empty-wardrobe wording", () => {
    expect(ASKING_NEMOTRON_MESSAGE).toBe("Asking Nemotron…");
    expect(CREATING_OUTFIT_MESSAGE).toBe("Asking Nemotron…");
    expect(FINDING_REPLACEMENT_MESSAGE).toBe("Asking Nemotron…");
    expect(NO_AVAILABLE_ITEMS_MESSAGE).toBe(ADD_AVAILABLE_ITEM_MESSAGE);
    expect(EMPTY_WARDROBE_MESSAGE).toBe(ADD_AVAILABLE_ITEM_MESSAGE);
    expect(generateFailureMessage(503, "fallback")).toBe(MODEL_UNAVAILABLE_MESSAGE);
    expect(generateFailureMessage(504, "fallback")).toBe(MODEL_UNAVAILABLE_MESSAGE);
    expect(generateFailureMessage(409, ADD_AVAILABLE_ITEM_MESSAGE)).toBe(ADD_AVAILABLE_ITEM_MESSAGE);
    expect(generateFailureMessage(409, "Those wardrobe items may have changed.")).toBe(
      "Those wardrobe items may have changed.",
    );
  });

  it("states missing shoes plainly instead of treating the look as complete", () => {
    expect(incompleteOutfitNote(["top", "bottom"])).toBe("This outfit is incomplete: shoes are missing.");
    expect(incompleteOutfitNote(["top", "bottom", "shoes"])).toBeNull();
    expect(garmentWhyLine({ categoryLabel: "Top", color: "navy", notes: "Everyday Wear" })).toBe("Everyday Wear");
  });
});
