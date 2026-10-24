"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { LogoutButton } from "@/components/LogoutButton";
import { WardrobeEntrance } from "@/components/WardrobeEntrance";
import { HOME_HOTSPOTS_WIDE } from "@/lib/home/room";
import type { PublicUser } from "@/lib/auth/cookies";
import { MOBILE_PRIMARY_NAV, NAV_ITEMS, isActivePath, navAccentVar } from "@/lib/nav";
import { useEntrance } from "@/lib/studio/entrance-context";

type Props = {
  user: PublicUser | null;
  children: React.ReactNode;
};

export function StudioShell({ user, children }: Props) {
  const pathname = usePathname();
  const { visible, replayEntrance } = useEntrance();
  const isHome = pathname === "/";
  const [helpOpen, setHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="studio-root">
      <WardrobeEntrance />
      <div className="studio-app" inert={visible} aria-hidden={visible || undefined}>
        {isHome ? null : (
          <aside className="studio-sidebar" aria-label="Studio">
            <BrandLink compact />
            <NavList pathname={pathname} />
          </aside>
        )}

        <div className="studio-main-column">
          <header className={isHome ? "studio-home-bar" : "studio-topbar"}>
            <div className="flex min-w-0 items-center gap-3">
              {isHome ? <BrandLink /> : <p className="truncate text-sm font-semibold text-foreground md:hidden">Vastra</p>}
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <AccountLinks user={user} />
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Help
              </button>
              {isHome ? null : (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold md:hidden"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  Menu
                </button>
              )}
            </div>
          </header>

          {menuOpen && !isHome ? (
            <nav className="studio-mobile-sheet md:hidden" aria-label="All pages">
              <NavList pathname={pathname} />
            </nav>
          ) : null}

          <main className={isHome ? "studio-home-main" : "studio-workspace"}>{children}</main>

          {isHome ? null : (
            <nav className="studio-mobile-bar md:hidden" aria-label="Primary mobile">
              <ul className="flex items-stretch justify-around gap-1">
                {NAV_ITEMS.filter((item) => MOBILE_PRIMARY_NAV.includes(item.href)).map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className="inline-flex min-h-12 min-w-16 flex-col items-center justify-center px-2 text-xs font-semibold text-foreground"
                      >
                        <span
                          className="mb-1 h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: navAccentVar(item.accent) }}
                          aria-hidden="true"
                        />
                        {item.label === "Saved Looks" ? "Looks" : item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </div>
      </div>

      {helpOpen ? (
        <HelpDialog
          onClose={() => setHelpOpen(false)}
          onReplay={() => {
            setHelpOpen(false);
            replayEntrance();
          }}
        />
      ) : null}
    </div>
  );
}

function BrandLink({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="font-display min-h-11 font-semibold tracking-tight text-foreground">
      Vastra {compact ? null : <span className="font-normal text-muted">(वस्त्र)</span>}
    </Link>
  );
}

function AccountLinks({ user }: { user: PublicUser | null }) {
  if (user) {
    return (
      <>
        <p className="hidden max-w-[10rem] truncate text-sm text-muted sm:block">
          <span className="font-semibold text-foreground">{user.username}</span>
        </p>
        <LogoutButton />
      </>
    );
  }
  return (
    <>
      <Link href="/signin" className="inline-flex min-h-11 items-center px-2 text-sm font-medium">
        Sign in
      </Link>
      <Link href="/register" className="btn-primary inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold">
        Register
      </Link>
    </>
  );
}

function NavList({ pathname }: { pathname: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-foreground hover:bg-black/5",
                active ? "bg-black/5" : "",
              ].join(" ")}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: navAccentVar(item.accent) }}
                aria-hidden="true"
              />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function HelpDialog({ onClose, onReplay }: { onClose: () => void; onReplay: () => void }) {
  const titleId = useId();
  return (
    <div className="studio-help" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="studio-help-card">
        <h2 id={titleId} className="font-display text-2xl font-semibold text-foreground">
          Navigation help
        </h2>
        <p className="mt-2 text-base text-muted">
          Home is a dressing room. Pins mark destinations. Other pages use the sidebar or Menu. Every route stays
          reachable from this list.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {HOME_HOTSPOTS_WIDE.map((hotspot) => (
            <li key={hotspot.id}>
              <Link
                href={hotspot.href}
                onClick={onClose}
                className="flex min-h-11 flex-col justify-center rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="font-semibold text-foreground">{hotspot.label}</span>
                <span className="text-muted">{hotspot.object}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onReplay}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-semibold"
          >
            Replay entrance
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-primary inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
