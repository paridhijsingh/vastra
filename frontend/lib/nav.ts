export type NavItem = {
  href: string;
  label: string;
  accent: "home" | "profile" | "wardrobe" | "dictionary";
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Home", accent: "home" },
  { href: "/stylist", label: "Stylist", accent: "home" },
  { href: "/wardrobe", label: "Wardrobe", accent: "wardrobe" },
  { href: "/looks", label: "Saved Looks", accent: "home" },
  { href: "/events", label: "Events", accent: "wardrobe" },
  { href: "/dictionary", label: "Style Dictionary", accent: "dictionary" },
  { href: "/profile", label: "Style Profile", accent: "profile" },
  { href: "/preferences", label: "Preferences", accent: "profile" },
  { href: "/emergency-fit", label: "Emergency Fit", accent: "home" },
  { href: "/rescue", label: "Rescue", accent: "home" },
] as const;

export const MOBILE_PRIMARY_NAV: readonly string[] = ["/", "/stylist", "/wardrobe", "/looks"];

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
