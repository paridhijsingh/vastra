import { describe, expect, it } from "vitest";

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
    for (const route of REQUIRED_ROUTES) {
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
