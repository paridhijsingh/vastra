import { describe, expect, it } from "vitest";

import {
  HOME_HOTSPOTS_PORTRAIT,
  HOME_HOTSPOTS_WIDE,
  HOME_ROOM_PORTRAIT,
  HOME_ROOM_WIDE,
  HOME_TUTORIAL_STEPS,
  hotspotById,
} from "@/lib/home/room";
import { NAV_ITEMS } from "@/lib/nav";

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
});
