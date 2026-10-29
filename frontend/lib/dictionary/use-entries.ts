"use client";

import { useEffect, useState } from "react";

import { parseDictionaryList, type DictionaryEntry } from "@/lib/dictionary/types";

let cachedEntries: DictionaryEntry[] | null = null;

export function useDictionaryEntries(): DictionaryEntry[] {
  const [entries, setEntries] = useState<DictionaryEntry[]>(cachedEntries ?? []);

  useEffect(() => {
    if (cachedEntries) {
      setEntries(cachedEntries);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/dictionary", {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = (await response.json().catch(() => ({}))) as { entries?: unknown };
        const parsed = parseDictionaryList(body.entries ?? []);
        if (!parsed || cancelled) return;
        cachedEntries = parsed;
        setEntries(parsed);
      } catch {
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return entries;
}
