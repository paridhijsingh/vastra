import { describe, expect, it } from "vitest";

import { HOW_IT_WORKS_INTRO, HOW_IT_WORKS_MODELS, NEMOTRON_NANO_BADGE, NEMOTRON_SUPER_BADGE } from "@/lib/ai";
import { HOME_FLOW_CARDS, HOME_HEADLINE, HOME_PROBLEM, INTRO_TAGLINE } from "@/lib/home/hero";
import {
  HOME_HOTSPOTS_PORTRAIT,
  HOME_HOTSPOTS_WIDE,
  HOME_ROOM_PORTRAIT,
  HOME_ROOM_WIDE,
  HOME_TUTORIAL_STEPS,
  hotspotById,
} from "@/lib/home/room";
import {
  MOBILE_PRIMARY_NAV,
  NAV_GROUPS,
  NAV_ITEMS,
  compactNavLabel,
  isAuthPath,
  showsAppNav,
} from "@/lib/nav";

const REQUIRED_ROUTES = [
  "/profile",
  "/preferences",
  "/wardrobe",
  "/emergency-fit",
  "/rescue",
  "/stylist",
  "/looks",
  "/events",
  "/dictionary",
] as const;

const NAV_ROUTES = [...REQUIRED_ROUTES, "/trends"] as const;

function assertHotspots(hotspots: readonly { href: string; label: string; hint: string; object: string; left: number; top: number }[]) {
  const hrefs = hotspots.map((hotspot) => hotspot.href);
  expect(new Set(hrefs).size).toBe(REQUIRED_ROUTES.length);
  for (const route of REQUIRED_ROUTES) {
    expect(hrefs).toContain(route);
  }
  for (const hotspot of hotspots) {
    expect(hotspot.label.trim().length).toBeGreaterThan(0);
    expect(hotspot.hint.trim().length).toBeGreaterThan(0);
    expect(hotspot.object.trim().length).toBeGreaterThan(0);
    expect(hotspot.left).toBeGreaterThanOrEqual(0);
    expect(hotspot.top).toBeGreaterThanOrEqual(0);
    expect(hotspot.left).toBeLessThanOrEqual(100);
    expect(hotspot.top).toBeLessThanOrEqual(100);
  }
}

describe("home dressing room", () => {
  it("keeps the above-the-fold headline, problem line, and three flow cards", () => {
    expect(INTRO_TAGLINE).toMatch(/styled by Nemotron/i);
    expect(HOME_HEADLINE).toBe("Ready, set, styled.");
    expect(HOME_PROBLEM).toMatch(/clothes you already own/i);
    expect(HOME_FLOW_CARDS.map((card) => card.href)).toEqual(["/emergency-fit", "/rescue", "/stylist"]);
    expect(HOME_FLOW_CARDS.every((card) => card.blurb.trim().length > 0)).toBe(true);
    expect(HOW_IT_WORKS_INTRO).toMatch(/Token Factory/i);
    expect(HOW_IT_WORKS_MODELS.map((model) => model.tier)).toEqual(["Nano", "Super", "Ultra"]);
    expect(NEMOTRON_NANO_BADGE).toBe("Styled by Nemotron Nano via Nebius Token Factory");
    expect(NEMOTRON_SUPER_BADGE).toBe("Styled by Nemotron Super via Nebius Token Factory");
  });

  it("maps every existing feature on wide and portrait layouts", () => {
    assertHotspots(HOME_HOTSPOTS_WIDE);
    assertHotspots(HOME_HOTSPOTS_PORTRAIT);
  });

  it("uses recognizable objects for the main destinations", () => {
    expect(hotspotById("stylist")?.object.toLowerCase()).toContain("mirror");
    expect(hotspotById("wardrobe")?.object.toLowerCase()).toContain("rail");
    expect(hotspotById("events")?.object.toLowerCase()).toContain("calendar");
    expect(hotspotById("dictionary")?.object.toLowerCase()).toContain("book");
    expect(hotspotById("looks")?.object.toLowerCase()).toContain("outfit");
    expect(hotspotById("profile")?.object.toLowerCase()).toContain("vanity");
    expect(hotspotById("preferences")?.object.toLowerCase()).toContain("vanity");
  });

  it("keeps separate wide and portrait room art and a short navigation tutorial", () => {
    expect(HOME_ROOM_WIDE.width / HOME_ROOM_WIDE.height).toBeGreaterThan(1);
    expect(HOME_ROOM_PORTRAIT.height / HOME_ROOM_PORTRAIT.width).toBeGreaterThan(1);
    expect(HOME_TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(3);
    expect(HOME_TUTORIAL_STEPS[0]?.title).toMatch(/dressing room/i);
    expect(HOME_TUTORIAL_STEPS.some((step) => /replay the entrance/i.test(step.body))).toBe(true);
  });

  it("does not persist an entrance-completed flag", async () => {
    const room = await import("@/lib/home/room");
    expect(room).not.toHaveProperty("DOORS_SESSION_KEY");
  });
});

describe("studio navigation", () => {
  it("keeps every existing route in the compact shell", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(hrefs).toContain("/");
    for (const route of NAV_ROUTES) {
      expect(hrefs).toContain(route);
    }
  });

  it("puts Emergency Fit on the mobile bar without dropping Saved Looks from the menu", () => {
    expect(MOBILE_PRIMARY_NAV).toEqual(["/", "/stylist", "/wardrobe", "/emergency-fit"]);
    expect(NAV_ITEMS.some((item) => item.href === "/looks")).toBe(true);
    expect(NAV_ITEMS.some((item) => item.href === "/rescue")).toBe(true);
    const emergency = NAV_ITEMS.find((item) => item.href === "/emergency-fit");
    expect(emergency).toBeDefined();
    expect(compactNavLabel(emergency!)).toBe("Emergency");
    expect(emergency?.label).toBe("Emergency Fit");
    expect(NAV_GROUPS.map((group) => group.label)).toEqual([null, "Style", "My closet", "Learn", null]);
    expect(NAV_GROUPS.find((group) => group.label === "Style")?.items.map((item) => item.href)).toEqual([
      "/emergency-fit",
      "/rescue",
      "/stylist",
      "/trends",
    ]);
    expect(NAV_GROUPS.find((group) => group.label === "My closet")?.items.map((item) => item.href)).toEqual([
      "/wardrobe",
      "/looks",
      "/events",
    ]);
    expect(NAV_GROUPS.find((group) => group.label === "Learn")?.items.map((item) => item.href)).toEqual(["/dictionary"]);
  });

  it("hides app navigation on home and authentication routes", () => {
    expect(showsAppNav("/")).toBe(false);
    expect(showsAppNav("/signin")).toBe(false);
    expect(showsAppNav("/register")).toBe(false);
    expect(showsAppNav("/wardrobe")).toBe(true);
    expect(showsAppNav("/emergency-fit")).toBe(true);
    expect(isAuthPath("/signin")).toBe(true);
    expect(isAuthPath("/register")).toBe(true);
    expect(isAuthPath("/wardrobe")).toBe(false);
  });
});
