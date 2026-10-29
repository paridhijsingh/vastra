import { describe, expect, it } from "vitest";

import {
  colorWash,
  groupWardrobeByCategory,
  itemMatchesQuery,
  recentlyAdded,
  sortWardrobeItems,
  visibleWardrobeItems,
  wardrobeCountLabel,
} from "@/lib/wardrobe/display";
import type { WardrobeItemPublic } from "@/lib/wardrobe/types";

function item(partial: Partial<WardrobeItemPublic> & Pick<WardrobeItemPublic, "id" | "name">): WardrobeItemPublic {
  return {
    owner_id: "user-1",
    category: "top",
    color: "navy",
    notes: "",
    availability: "available",
    ...partial,
  };
}

describe("recentlyAdded", () => {
  it("stays empty until there are three records", () => {
    expect(recentlyAdded([])).toEqual([]);
    expect(recentlyAdded([item({ id: "a", name: "A" })])).toEqual([]);
    expect(recentlyAdded([item({ id: "a", name: "A" }), item({ id: "b", name: "B" })])).toEqual([]);
  });

  it("takes the last three items in reverse, matching oldest-first API order", () => {
    const loaded = [
      item({ id: "1", name: "Oldest" }),
      item({ id: "2", name: "Second" }),
      item({ id: "3", name: "Third" }),
      item({ id: "4", name: "Newest" }),
    ];
    expect(recentlyAdded(loaded).map((entry) => entry.id)).toEqual(["4", "3", "2"]);
  });
});

describe("search and sort", () => {
  const kurta = item({ id: "a", name: "Navy kurta", notes: "cotton", color: "navy" });
  const silk = item({
    id: "b",
    name: "Navy kurta",
    notes: "silk",
    color: "navy",
    availability: "in_laundry",
  });
  const shoes = item({ id: "c", name: "Juttis", category: "shoes", color: "gold" });

  it("matches name, notes, category, color, and availability labels", () => {
    expect(itemMatchesQuery(kurta, "kurta")).toBe(true);
    expect(itemMatchesQuery(kurta, "cotton")).toBe(true);
    expect(itemMatchesQuery(shoes, "shoes")).toBe(true);
    expect(itemMatchesQuery(silk, "laundry")).toBe(true);
    expect(itemMatchesQuery(kurta, "gold")).toBe(false);
    expect(itemMatchesQuery(kurta, "  ")).toBe(true);
  });

  it("sorts by name and keeps duplicate names distinct by id", () => {
    const sorted = sortWardrobeItems([silk, shoes, kurta], "name");
    expect(sorted.map((entry) => entry.id)).toEqual(["c", "a", "b"]);
  });

  it("keeps API order when sorting by added", () => {
    expect(sortWardrobeItems([kurta, silk, shoes], "added").map((entry) => entry.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("filters then sorts without dropping duplicate-name items", () => {
    const visible = visibleWardrobeItems([kurta, silk, shoes], "navy", "name");
    expect(visible.map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});

describe("groupWardrobeByCategory", () => {
  it("groups under category headers without flattening shoes into tops", () => {
    const grouped = groupWardrobeByCategory([
      item({ id: "a", name: "Kurta", category: "top" }),
      item({ id: "b", name: "Oxfords", category: "shoes" }),
      item({ id: "c", name: "Shirt", category: "top" }),
    ]);
    expect(grouped.map((group) => group.label)).toEqual(["Top", "Shoes"]);
    expect(grouped[0].items.map((entry) => entry.id)).toEqual(["a", "c"]);
  });
});

describe("colorWash", () => {
  it("uses recognized color words only", () => {
    expect(colorWash("navy")).toBe("#1f3a5f");
    expect(colorWash("Deep Navy silk")).toBe("#1f3a5f");
    expect(colorWash("chartreuse")).toBeUndefined();
    expect(colorWash("")).toBeUndefined();
  });
});

describe("wardrobeCountLabel", () => {
  it("describes loaded and matching counts", () => {
    expect(wardrobeCountLabel(1, 1, "")).toBe("1 piece");
    expect(wardrobeCountLabel(12, 12, "")).toBe("12 pieces");
    expect(wardrobeCountLabel(12, 1, "kurta")).toBe("1 matching piece");
    expect(wardrobeCountLabel(12, 3, "navy")).toBe("3 matching pieces");
  });
});
