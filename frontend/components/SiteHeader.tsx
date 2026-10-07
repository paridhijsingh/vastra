"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  accentVar: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", accentVar: "var(--accent-home)" },
  { href: "/profile", label: "Style Profile", accentVar: "var(--accent-profile)" },
  { href: "/wardrobe", label: "Wardrobe", accentVar: "var(--accent-wardrobe)" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border/80 bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            href="/"
            className="font-display w-fit max-w-full text-3xl font-semibold tracking-tight text-foreground break-words sm:text-4xl"
          >
            Vastra <span className="font-normal text-muted">(वस्त्र)</span>
          </Link>
          <p className="text-base text-muted sm:text-lg">Ready, set, styled.</p>
        </div>

        <nav aria-label="Primary" className="min-w-0">
          <ul className="flex flex-wrap gap-x-1 gap-y-1 sm:gap-x-2">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href} className="min-w-0">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "inline-flex min-h-11 max-w-full items-center px-2.5 py-2 text-sm font-medium transition-colors sm:px-3 sm:text-base",
                      "rounded-sm text-foreground hover:bg-black/5",
                      active ? "border-b-[3px]" : "border-b-[3px] border-transparent",
                    ].join(" ")}
                    style={active ? { borderBottomColor: item.accentVar } : undefined}
                  >
                    <span
                      className="mr-2 inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.accentVar }}
                      aria-hidden="true"
                    />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
