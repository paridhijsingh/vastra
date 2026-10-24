export type HomeHotspot = {
  id: string;
  href: string;
  label: string;
  hint: string;
  object: string;
  /** Anchor as a percentage of the room art box. */
  left: number;
  top: number;
  accent: "primary" | "profile" | "wardrobe" | "dictionary";
};

export const HOME_ROOM_WIDE = {
  src: "/home/dressing-room-wide.jpg",
  width: 1280,
  height: 720,
} as const;

export const HOME_ROOM_PORTRAIT = {
  src: "/home/dressing-room-portrait.jpg",
  width: 864,
  height: 1152,
} as const;

export const HOME_ROOM_ALT =
  "Illustrated dressing room with a clothing rail, standing mirror, mannequin in a fusion outfit, wall calendar, open fashion book, vanity, sewing basket, and overnight bag.";

const SHARED_HOTSPOTS = {
  wardrobe: {
    id: "wardrobe",
    href: "/wardrobe",
    label: "Wardrobe",
    object: "Clothing rail",
    hint: "The hanging rail holds Indian, Western, and fusion clothes you save.",
    accent: "wardrobe",
  },
  profile: {
    id: "profile",
    href: "/profile",
    label: "Style Profile",
    object: "Vanity drawers",
    hint: "The vanity drawers keep how you like clothes to fit and feel.",
    accent: "profile",
  },
  preferences: {
    id: "preferences",
    href: "/preferences",
    label: "Preferences",
    object: "Vanity tray",
    hint: "The tray on the vanity holds styling preferences you confirm.",
    accent: "profile",
  },
  stylist: {
    id: "stylist",
    href: "/stylist",
    label: "Stylist",
    object: "Mirror",
    hint: "Ask your personal stylist at the standing mirror.",
    accent: "primary",
  },
  looks: {
    id: "looks",
    href: "/looks",
    label: "Saved Looks",
    object: "Outfit display",
    hint: "The mannequin stands in for complete outfits you choose to save.",
    accent: "primary",
  },
  dictionary: {
    id: "dictionary",
    href: "/dictionary",
    label: "Style Dictionary",
    object: "Fashion book",
    hint: "The open book is for garment names and style notes.",
    accent: "dictionary",
  },
  events: {
    id: "events",
    href: "/events",
    label: "Events",
    object: "Calendar",
    hint: "The wall calendar is for occasions you are dressing toward.",
    accent: "wardrobe",
  },
  "emergency-fit": {
    id: "emergency-fit",
    href: "/emergency-fit",
    label: "Emergency Fit",
    object: "Overnight bag",
    hint: "The tote and clock are for a last-minute outfit from clothes you already own.",
    accent: "primary",
  },
  rescue: {
    id: "rescue",
    href: "/rescue",
    label: "Rescue",
    object: "Sewing basket",
    hint: "The repair basket is for swapping one piece in an outfit that is not working.",
    accent: "primary",
  },
} as const;

function placed(
  id: keyof typeof SHARED_HOTSPOTS,
  left: number,
  top: number,
): HomeHotspot {
  return { ...SHARED_HOTSPOTS[id], left, top };
}

export const HOME_HOTSPOTS_WIDE: readonly HomeHotspot[] = [
  placed("wardrobe", 24, 18),
  placed("stylist", 40, 26),
  placed("looks", 54, 24),
  placed("events", 68, 16),
  placed("preferences", 14, 52),
  placed("profile", 12, 72),
  placed("dictionary", 72, 54),
  placed("emergency-fit", 90, 64),
  placed("rescue", 78, 82),
];

export const HOME_HOTSPOTS_PORTRAIT: readonly HomeHotspot[] = [
  placed("events", 78, 12),
  placed("wardrobe", 28, 18),
  placed("stylist", 52, 20),
  placed("looks", 64, 46),
  placed("preferences", 24, 62),
  placed("profile", 22, 74),
  placed("dictionary", 48, 80),
  placed("rescue", 72, 84),
  placed("emergency-fit", 88, 70),
];

/** @deprecated Use HOME_HOTSPOTS_WIDE or hotspotsForViewport */
export const HOME_HOTSPOTS = HOME_HOTSPOTS_WIDE;

export type HomeTutorialStep = {
  id: string;
  title: string;
  body: string;
  hotspotId?: string;
};

export const HOME_TUTORIAL_STEPS: readonly HomeTutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to your dressing room",
    body: "Each labeled pin marks a real object. Hover, focus, or tap a pin to read it, then use Open. Help lists every destination if you prefer a list.",
  },
  {
    id: "wardrobe",
    title: "Find your clothes",
    body: "The clothing rail is Wardrobe. Start there when you want to add or update garments.",
    hotspotId: "wardrobe",
  },
  {
    id: "stylist",
    title: "Ask at the mirror",
    body: "The standing mirror opens your personal stylist. Describe an occasion or a garment you already own.",
    hotspotId: "stylist",
  },
  {
    id: "more",
    title: "Everything stays reachable",
    body: "The vanity has Style Profile and Preferences as separate links. Calendar, book, mannequin, bag, and basket open the rest. You can replay the entrance from Help.",
  },
];

export const TUTORIAL_STORAGE_KEY = "vastra-home-tutorial-done";

export function hotspotsForViewport(portrait: boolean): readonly HomeHotspot[] {
  return portrait ? HOME_HOTSPOTS_PORTRAIT : HOME_HOTSPOTS_WIDE;
}

export function hotspotById(id: string | null | undefined, portrait = false): HomeHotspot | null {
  if (!id) return null;
  return hotspotsForViewport(portrait).find((hotspot) => hotspot.id === id) ?? null;
}

export function accentDotClass(accent: HomeHotspot["accent"]): string {
  switch (accent) {
    case "profile":
      return "bg-accent-profile";
    case "wardrobe":
      return "bg-accent-wardrobe";
    case "dictionary":
      return "bg-accent-dictionary";
    default:
      return "bg-primary";
  }
}

export function accentTextClass(accent: HomeHotspot["accent"]): string {
  switch (accent) {
    case "profile":
      return "text-accent-profile-text";
    case "wardrobe":
      return "text-accent-wardrobe-text";
    case "dictionary":
      return "text-accent-dictionary-text";
    default:
      return "text-primary";
  }
}
