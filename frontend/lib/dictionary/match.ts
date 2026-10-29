import type { DictionaryEntry } from "@/lib/dictionary/types";

const GENERIC_HEADS = new Set(["fabric", "fit", "casual", "blocking", "coat", "drape", "cloth"]);

function phrasesFor(entry: DictionaryEntry): string[] {
  const phrases = [entry.term, ...entry.aliases]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  const extra: string[] = [];
  for (const phrase of phrases) {
    const words = phrase.split(/[\s/]+/).filter(Boolean);
    if (words.length > 1) {
      const head = words[0].replace(/[^a-z0-9-]/g, "");
      if (head.length >= 4 && !GENERIC_HEADS.has(head)) extra.push(head);
    }
  }
  return [...new Set([...phrases, ...extra])].sort((left, right) => right.length - left.length);
}

function nameContainsPhrase(name: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(name);
}

/** Match a garment name to existing dictionary terms and aliases. Invent nothing. */
export function matchDictionaryEntries(
  name: string,
  entries: readonly DictionaryEntry[],
): DictionaryEntry[] {
  const haystack = name.trim();
  if (!haystack || entries.length === 0) return [];
  const matched: DictionaryEntry[] = [];
  for (const entry of entries) {
    if (phrasesFor(entry).some((phrase) => nameContainsPhrase(haystack, phrase))) {
      matched.push(entry);
    }
  }
  return matched;
}
