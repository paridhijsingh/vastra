import { describe, expect, it } from "vitest";

import { EMERGENCY_FIT_EXPLANATION } from "@/lib/emergency/form";
import { HELP_SECTIONS, HELP_TITLE, PAGE_DESCRIPTIONS } from "@/lib/help";
import { RESCUE_EXPLANATION } from "@/lib/rescue/form";
import { TREND_PAGE_EXPLANATION } from "@/lib/trends/form";

describe("page descriptions and Help manual", () => {
  it("covers every studio page and does not mention excluded features", () => {
    expect(PAGE_DESCRIPTIONS.emergencyFit).toMatch(/Nemotron Nano/i);
    expect(PAGE_DESCRIPTIONS.rescue).toMatch(/swap just that piece/i);
    expect(PAGE_DESCRIPTIONS.stylist).toMatch(/own words/i);
    expect(PAGE_DESCRIPTIONS.trends).toMatch(/sources and dates/i);
    expect(PAGE_DESCRIPTIONS.wardrobe).toMatch(/available, in laundry, or packed away/i);
    expect(PAGE_DESCRIPTIONS.looks).toMatch(/Emergency Fit, Rescue, and Stylist chat/i);
    expect(PAGE_DESCRIPTIONS.events).toMatch(/occasions you are planning/i);
    expect(PAGE_DESCRIPTIONS.dictionary).toMatch(/What’s this\?/i);
    expect(PAGE_DESCRIPTIONS.preferences).toMatch(/Emergency Fit, Rescue, and Stylist chat/i);
    expect(PAGE_DESCRIPTIONS.profile).toMatch(/when you have saved one/i);
    expect(EMERGENCY_FIT_EXPLANATION).toBe(PAGE_DESCRIPTIONS.emergencyFit);
    expect(RESCUE_EXPLANATION).toBe(PAGE_DESCRIPTIONS.rescue);
    expect(TREND_PAGE_EXPLANATION).toBe(PAGE_DESCRIPTIONS.trends);
    const all = `${Object.values(PAGE_DESCRIPTIONS).join(" ")} ${HELP_SECTIONS.map((section) => section.body).join(" ")}`;
    expect(all.toLowerCase()).not.toMatch(/\bweather\b/);
    expect(all.toLowerCase()).not.toMatch(/photo wardrobe/);
  });

  it("puts How Vastra works in Help with seven sections", () => {
    expect(HELP_TITLE).toBe("How Vastra works");
    expect(HELP_SECTIONS.map((section) => section.title)).toEqual([
      "Why “Vastra”?",
      "What Vastra is",
      "The one rule",
      "Start in 30 seconds (demo)",
      "Each flow, step by step",
      "Which model does what",
      "Good to know",
    ]);
    expect(HELP_SECTIONS[4]?.body).toMatch(/budget/i);
    expect(HELP_SECTIONS[4]?.body).not.toMatch(/optional budget/i);
    expect(HELP_SECTIONS[4]?.body).toMatch(/only from saved pieces/i);
  });
});
