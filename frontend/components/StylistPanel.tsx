"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";

import { SaveLookForm } from "@/components/SaveLookForm";
import {
  MIXED_OUTFIT_SAVE_MESSAGE,
  STYLIST_EXAMPLE_PROMPTS,
  STYLIST_MESSAGE_MAX,
  historyForRequest,
  messageError,
  replyFromApi,
  type StylistPieceView,
  type StylistReplyView,
  type StylistSuggestionView,
  type StylistTurn,
} from "@/lib/stylist/form";

type ChatEntry = {
  user: string;
  reply: StylistReplyView;
};

type Props = {
  userId: string;
};

export function StylistPanel({ userId }: Props) {
  const router = useRouter();
  const formId = useId();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const pendingRef = useRef(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<StylistTurn[]>([]);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function fillExample(prompt: string) {
    if (pendingRef.current) return;
    setMessage(prompt);
    setFieldError(null);
    setFormError(null);
    composerRef.current?.focus();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pendingRef.current) return;
    const error = messageError(message);
    if (error) {
      setFieldError(error);
      setFormError(null);
      return;
    }
    const trimmed = message.trim();
    const sentHistory = historyForRequest(history, trimmed);
    pendingRef.current = true;
    setPending(true);
    setFieldError(null);
    setFormError(null);
    try {
      const response = await fetch("/api/stylist/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ message: trimmed, history: sentHistory }),
      });
      if (response.status === 401) {
        router.push("/signin?next=/stylist");
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      const record = payload && typeof payload === "object" ? (payload as { error?: unknown; reply?: unknown }) : {};
      if (!response.ok) {
        setFormError(typeof record.error === "string" ? record.error : "The stylist reply could not be used. Please try again.");
        return;
      }
      const reply = replyFromApi(record.reply);
      if (!reply) {
        setFormError("The stylist reply could not be used. Please try again.");
        return;
      }
      setEntries((current) => [...current, { user: trimmed, reply }]);
      setHistory(historyForRequest([...sentHistory, { role: "user", content: trimmed }, { role: "assistant", content: reply.message }], ""));
      setMessage("");
    } catch {
      setFormError("Outfit suggestions are temporarily unavailable. Please try again later.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  const latestOutfit = [...entries].reverse().find((entry) => entry.reply.suggestions.length > 0)?.reply.suggestions[0] ?? null;

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:h-[calc(100dvh-7.5rem)] lg:flex-row" key={userId}>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
      <section className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto" aria-label="Conversation">
        {entries.length === 0 ? (
          <div
            className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface px-5 py-6 sm:px-6"
            role="status"
          >
            <p className="font-display text-xl font-semibold text-foreground">Start a conversation</p>
            <p className="text-base text-muted">
              Describe the occasion, a garment you already own, or a style you want to keep. Choose an
              example below to fill the message box, then send when you are ready.
            </p>
            <ExamplePrompts disabled={pending} onSelect={fillExample} />
          </div>
        ) : (
          <ol className="flex flex-col gap-6" aria-live="polite">
            {entries.map((entry, index) => (
              <li key={`${index}-${entry.user.slice(0, 24)}`} className="flex flex-col gap-3">
                <article
                  className="ml-auto w-full max-w-[min(100%,28rem)] rounded-2xl rounded-br-md border border-primary/25 bg-primary/[0.08] px-4 py-3 sm:px-5 sm:py-4"
                  aria-label="Your message"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">You</p>
                  <p className="mt-2 whitespace-pre-wrap text-base text-foreground">{entry.user}</p>
                </article>
                <article
                  className="mr-auto w-full max-w-[min(100%,40rem)] rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-4"
                  aria-label={entry.reply.kind === "clarification" ? "Stylist question" : "Stylist reply"}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-wardrobe-text">Stylist</p>
                  <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-foreground">{entry.reply.message}</p>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-xl border border-border bg-background px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bg-surface sm:px-5 sm:py-4"
        aria-busy={pending}
      >
        {entries.length > 0 ? (
          <ExamplePrompts disabled={pending} onSelect={fillExample} compact />
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-message`} className="text-base font-semibold text-foreground">
            Message
          </label>
          <p id={`${formId}-message-hint`} className="text-sm text-muted">
            Ask for an outfit. The stylist replies only when you send a message.
          </p>
          <textarea
            ref={composerRef}
            id={`${formId}-message`}
            name="message"
            value={message}
            maxLength={STYLIST_MESSAGE_MAX}
            rows={4}
            disabled={pending}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={
              fieldError ? `${formId}-message-hint ${formId}-message-error` : `${formId}-message-hint`
            }
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-3 text-base text-foreground transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70 sm:bg-surface"
            placeholder="Describe the occasion or the clothes you want to style…"
          />
        </div>

        {fieldError ? (
          <p id={`${formId}-message-error`} className="text-base text-accent-profile-text" role="alert">
            {fieldError}
          </p>
        ) : null}
        {formError ? (
          <p className="rounded-md border border-accent-profile/30 bg-surface px-4 py-3 text-base text-accent-profile-text" role="alert">
            {formError}
          </p>
        ) : null}
        {pending ? (
          <p role="status" className="text-base font-semibold text-primary">
            Asking the stylist…
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted" aria-live="polite">
            {message.trim().length}/{STYLIST_MESSAGE_MAX}
          </p>
          <button
            type="submit"
            disabled={pending}
            className="btn-primary inline-flex min-h-12 w-full items-center justify-center rounded-md px-5 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            Send
          </button>
        </div>
      </form>
      </div>

      <aside
        className="min-w-0 lg:w-[min(100%,28rem)] lg:shrink-0 lg:overflow-auto"
        aria-label="Latest outfit"
      >
        {latestOutfit ? (
          <OutfitCard suggestion={latestOutfit} />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-base text-muted" role="status">
            Proposed outfits appear here. On a wide screen they sit beside the conversation.
          </div>
        )}
      </aside>
    </div>
  );
}

function ExamplePrompts({
  disabled,
  onSelect,
  compact = false,
}: {
  disabled: boolean;
  onSelect: (prompt: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-foreground">
        {compact ? "Try another prompt" : "Example prompts"}
      </p>
      <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {STYLIST_EXAMPLE_PROMPTS.map((prompt) => (
          <li key={prompt} className="min-w-0 sm:max-w-xs">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(prompt)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OutfitCard({ suggestion }: { suggestion: StylistSuggestionView }) {
  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-4 py-4 sm:px-5 sm:py-5"
      aria-label={suggestion.title}
    >
      <div className="flex flex-col gap-2 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-accent-wardrobe" aria-hidden="true" />
          <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground break-words">
            {suggestion.title}
          </h3>
        </div>
        {suggestion.note ? (
          <p className="text-base leading-relaxed text-muted">{suggestion.note}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">Garments</h4>
        <ul className="flex flex-col gap-3">
          {suggestion.pieces.map((piece, pieceIndex) => (
            <GarmentRow key={`${piece.source}-${piece.wardrobeItemId ?? piece.name}-${pieceIndex}`} piece={piece} />
          ))}
        </ul>
      </div>

      <div className="border-t border-border pt-4">
        {suggestion.lookItemIds ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">All pieces are from your saved wardrobe. You can save this outfit.</p>
            <SaveLookForm itemIds={suggestion.lookItemIds} defaultName={suggestion.title} defaultOccasion="" />
          </div>
        ) : (
          <p className="rounded-md border border-border bg-surface px-4 py-3 text-base text-muted" role="status">
            {MIXED_OUTFIT_SAVE_MESSAGE}
          </p>
        )}
      </div>
    </section>
  );
}

function GarmentRow({ piece }: { piece: StylistPieceView }) {
  return (
    <li className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="font-display text-lg font-semibold text-foreground break-words">{piece.name}</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="font-semibold text-muted">Category</dt>
          <dd className="text-foreground">{piece.categoryLabel}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="font-semibold text-muted">Color</dt>
          <dd className="text-foreground">{piece.color ?? "Not listed"}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 sm:col-span-2">
          <dt className="font-semibold text-muted">Notes</dt>
          <dd className="break-words text-foreground">{piece.notes.trim() ? piece.notes : "None"}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="font-semibold text-muted">Source</dt>
          <dd className="font-semibold text-primary">{piece.sourceLabel}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="font-semibold text-muted">Availability</dt>
          <dd className="text-foreground">{piece.availabilityLabel}</dd>
        </div>
      </dl>
    </li>
  );
}
