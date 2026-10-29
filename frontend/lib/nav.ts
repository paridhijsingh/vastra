export type NavItem = {
  href: string;
  label: string;
  accent: "home" | "profile" | "wardrobe" | "dictionary";
};

export type NavGroup = {
  id: string;
  label: string | null;
  items: readonly NavItem[];
};

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "home",
    label: null,
    items: [{ href: "/", label: "Home", accent: "home" }],
  },
  {
    id: "style",
    label: "Style",
    items: [
      { href: "/emergency-fit", label: "Emergency Fit", accent: "home" },
      { href: "/rescue", label: "Rescue My Outfit", accent: "home" },
      { href: "/stylist", label: "Stylist chat", accent: "home" },
      { href: "/trends", label: "Trend Stylist", accent: "home" },
    ],
  },
  {
    id: "closet",
    label: "My closet",
    items: [
      { href: "/wardrobe", label: "Wardrobe", accent: "wardrobe" },
      { href: "/looks", label: "Saved Looks", accent: "home" },
      { href: "/events", label: "Saved Events", accent: "wardrobe" },
    ],
  },
  {
    id: "learn",
    label: "Learn",
    items: [{ href: "/dictionary", label: "Style Dictionary", accent: "dictionary" }],
  },
  {
    id: "account",
    label: null,
    items: [
      { href: "/profile", label: "Style Profile", accent: "profile" },
      { href: "/preferences", label: "Preferences", accent: "profile" },
    ],
  },
] as const;

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => [...group.items]);

export const MOBILE_PRIMARY_NAV: readonly string[] = ["/", "/stylist", "/wardrobe", "/emergency-fit"];

export function isAuthPath(pathname: string): boolean {
  return pathname === "/signin" || pathname === "/register";
}

export function showsAppNav(pathname: string): boolean {
  return pathname !== "/" && !isAuthPath(pathname);
}

export function compactNavLabel(item: NavItem): string {
  if (item.href === "/looks") return "Looks";
  if (item.href === "/emergency-fit") return "Emergency";
  if (item.href === "/trends") return "Trends";
  if (item.href === "/rescue") return "Rescue";
  if (item.href === "/stylist") return "Stylist";
  if (item.href === "/events") return "Events";
  return item.label;
}

export function navAccentVar(accent: NavItem["accent"]): string {
  switch (accent) {
    case "profile":
      return "var(--accent-profile)";
    case "wardrobe":
      return "var(--accent-wardrobe)";
    case "dictionary":
      return "var(--accent-dictionary)";
    default:
      return "var(--accent-home)";
  }
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
