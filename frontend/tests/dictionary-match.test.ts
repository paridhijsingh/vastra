import { describe, expect, it } from "vitest";

import { matchDictionaryEntries } from "@/lib/dictionary/match";
import { groupDictionaryByKind, type DictionaryEntry } from "@/lib/dictionary/types";

function entry(partial: Partial<DictionaryEntry> & Pick<DictionaryEntry, "id" | "term" | "kind">): DictionaryEntry {
  return {
    origin: "shared",
    aliases: [],
    definition: `${partial.term} definition.`,
    styles: [],
    style_tags: [],
    cultural_context: null,
    pairing_suggestions: [],
    occasions: [],
    weather_notes: [],
    comfort_notes: [],
    guidance_type: "general",
    ...partial,
  };
}

const ENTRIES = [
  entry({ id: "kurta", term: "Kurta", kind: "garment", aliases: ["kurta shirt"] }),
  entry({ id: "silk", term: "Silk", kind: "fabric" }),
  entry({ id: "blazer", term: "Blazer", kind: "garment" }),
  entry({ id: "saree-drape", term: "Saree drape", kind: "styling_technique", aliases: ["sari drape"] }),
  entry({ id: "linen", term: "Linen", kind: "fabric" }),
  entry({ id: "palazzo-pants", term: "Palazzo pants", kind: "garment", aliases: ["palazzo"] }),
  entry({ id: "jhumka", term: "Jhumka", kind: "garment", aliases: ["jhumka earrings", "jhumkas"] }),
  entry({ id: "anarkali", term: "Anarkali", kind: "garment", aliases: ["anarkali suit"] }),
  entry({ id: "nehru-jacket", term: "Nehru jacket", kind: "garment", aliases: ["nehru"] }),
];

describe("dictionary name matching", () => {
  it("matches existing terms in a garment name and stays silent when none exist", () => {
    expect(matchDictionaryEntries("Demo — Ivory silk kurta", ENTRIES).map((row) => row.id)).toEqual([
      "kurta",
      "silk",
    ]);
    expect(matchDictionaryEntries("Demo — Navy blazer", ENTRIES).map((row) => row.id)).toEqual(["blazer"]);
    expect(matchDictionaryEntries("Demo — Navy palazzo pants", ENTRIES).map((row) => row.id)).toEqual([
      "palazzo-pants",
    ]);
    expect(matchDictionaryEntries("Demo — Gold jhumka earrings", ENTRIES).map((row) => row.id)).toEqual(["jhumka"]);
    expect(matchDictionaryEntries("Demo — Emerald festive anarkali", ENTRIES).map((row) => row.id)).toEqual([
      "anarkali",
    ]);
    expect(matchDictionaryEntries("Demo — Maroon fusion nehru jacket", ENTRIES).map((row) => row.id)).toEqual([
      "nehru-jacket",
    ]);
    expect(matchDictionaryEntries("Silk saree", ENTRIES).map((row) => row.id)).toEqual(["silk", "saree-drape"]);
  });
});

describe("dictionary grouping", () => {
  it("uses the stored kind field, including saree drape as a styling technique", () => {
    const groups = groupDictionaryByKind(ENTRIES);
    expect(groups.map((group) => group.label)).toEqual(["Garments", "Fabrics", "Styling techniques"]);
    expect(groups.find((group) => group.kind === "garment")?.entries.map((row) => row.id)).toEqual([
      "kurta",
      "blazer",
      "palazzo-pants",
      "jhumka",
      "anarkali",
      "nehru-jacket",
    ]);
    expect(groups.find((group) => group.kind === "styling_technique")?.entries.map((row) => row.id)).toEqual([
      "saree-drape",
    ]);
  });
});
