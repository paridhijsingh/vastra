"use client";

import { useId, useState } from "react";

import { matchDictionaryEntries } from "@/lib/dictionary/match";
import { useDictionaryEntries } from "@/lib/dictionary/use-entries";

type Props = {
  name: string;
  as?: "h3" | "p";
  className?: string;
};

export function ItemTermHint({ name, as = "h3", className }: Props) {
  const entries = useDictionaryEntries();
  const matches = matchDictionaryEntries(name, entries);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const Title = as;
  const titleClass =
    className ??
    (as === "h3"
      ? "font-display text-lg font-semibold leading-snug text-foreground break-words"
      : "font-display text-base font-semibold text-foreground break-words");

  if (matches.length === 0) {
    return <Title className={titleClass}>{name}</Title>;
  }

  return (
    <div className="item-term-hint">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <Title className={titleClass}>{name}</Title>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className="item-term-link"
        >
          What’s this?
        </button>
      </div>
      {open ? (
        <div id={panelId} className="item-term-panel" role="region" aria-label="Style Dictionary">
          {matches.map((entry) => (
            <p key={entry.id} className="text-sm text-muted">
              <span className="font-semibold text-foreground">{entry.term}. </span>
              {entry.definition}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
