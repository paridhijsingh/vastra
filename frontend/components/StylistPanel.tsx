"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

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
  const threadEndRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<StylistTurn[]>([]);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const page = document.querySelector(".stylist-page");
    const viewport = window.visualViewport;
    if (!(page instanceof HTMLElement) || !viewport) return;

    const syncKeyboard = () => {
      const obscured = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      page.style.setProperty("--stylist-keyboard", `${obscured}px`);
    };

    viewport.addEventListener("resize", syncKeyboard);
    viewport.addEventListener("scroll", syncKeyboard);
    syncKeyboard();
    return () => {
      viewport.removeEventListener("resize", syncKeyboard);
      viewport.removeEventListener("scroll", syncKeyboard);
      page.style.removeProperty("--stylist-keyboard");
    };
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [entries, pending]);

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
    <div className="stylist-panel" key={userId}>
      <section className="stylist-thread" aria-label="Conversation">
        {entries.length === 0 ? (
          <div className="stylist-empty" role="status">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-primary">Consultation</p>
            <p className="font-display text-xl font-semibold text-foreground">Start a conversation</p>
            <p className="text-base text-muted">
              Describe the occasion, a garment you already own, or a style you want to keep. Choose an
              example below to fill the message box, then send when you are ready.
            </p>
            <ExamplePrompts disabled={pending} onSelect={fillExample} />
          </div>
        ) : (
          <ol className="flex flex-col gap-5" aria-live="polite">
            {entries.map((entry, index) => (
              <li key={`${index}-${entry.user.slice(0, 24)}`} className="flex min-w-0 flex-col gap-3">
                <article className="stylist-you" aria-label="Your message">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-primary">You</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-base text-foreground">{entry.user}</p>
                </article>
                <article
                  className="stylist-reply"
                  aria-label={entry.reply.kind === "clarification" ? "Stylist question" : "Stylist reply"}
                >
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent-wardrobe-text">
                    Stylist
                  </p>
                  <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed text-foreground">
                    {entry.reply.message}
                  </p>
                </article>
              </li>
            ))}
          </ol>
        )}
        <div ref={threadEndRef} />
      </section>

      <aside className="stylist-outfit" aria-label="Latest outfit">
        {latestOutfit ? (
          <div className="stylist-outfit-card">
            <OutfitCard suggestion={latestOutfit} />
          </div>
        ) : (
          <div className="stylist-outfit-empty" role="status">
            Proposed outfits appear here. On a wide screen they sit beside the conversation.
          </div>
        )}
      </aside>

      <form onSubmit={onSubmit} className="stylist-composer" aria-busy={pending}>
        {entries.length > 0 ? (
          <ExamplePrompts disabled={pending} onSelect={fillExample} compact />
        ) : null}

        <div className="flex min-w-0 flex-col gap-2">
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
            rows={3}
            disabled={pending}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={
              fieldError ? `${formId}-message-hint ${formId}-message-error` : `${formId}-message-hint`
            }
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-[4.75rem] w-full rounded-lg border border-border bg-background px-3 py-3 text-base text-foreground transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70 sm:min-h-28 sm:bg-surface"
            placeholder="Describe the occasion or the clothes you want to style…"
          />
        </div>

        {fieldError ? (
          <p id={`${formId}-message-error`} className="error-alert text-sm" role="alert">
            {fieldError}
          </p>
        ) : null}
        {formError ? (
          <p className="error-alert text-sm" role="alert">
            {formError}
          </p>
        ) : null}
        {pending ? (
          <p role="status" className="status-card text-sm font-semibold text-primary">
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
            className="btn-primary inline-flex min-h-12 w-full items-center justify-center rounded-md px-5 text-base font-semibold sm:w-auto"
          >
            Send
          </button>
        </div>
      </form>
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
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-sm font-semibold text-foreground">
        {compact ? "Try another prompt" : "Example prompts"}
      </p>
      <ul className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
        {STYLIST_EXAMPLE_PROMPTS.map((prompt) => (
          <li key={prompt} className="min-w-0">
            <button type="button" disabled={disabled} onClick={() => onSelect(prompt)} className="stylist-prompt">
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
      className="flex flex-col gap-4 rounded-[0.85rem] border border-border bg-surface px-4 py-4 sm:px-5 sm:py-5"
      aria-label={suggestion.title}
    >
      <div className="flex flex-col gap-2 border-b border-border pb-4">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent-wardrobe-text">
          Proposed look
        </p>
        <div className="flex items-start gap-2">
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent-wardrobe" aria-hidden="true" />
          <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground break-words">
            {suggestion.title}
          </h3>
        </div>
        {suggestion.note ? (
          <p className="text-base leading-relaxed text-muted">{suggestion.note}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">Garments</h4>
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
          <p className="status-card text-base text-muted" role="status">
            {MIXED_OUTFIT_SAVE_MESSAGE}
          </p>
        )}
      </div>
    </section>
  );
}

function GarmentRow({ piece }: { piece: StylistPieceView }) {
  return (
    <li className="rounded-lg border border-border bg-background px-4 py-3">
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
