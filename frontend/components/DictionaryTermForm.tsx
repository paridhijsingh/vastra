"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";

import {
  DICTIONARY_CONTEXT_MAX,
  DICTIONARY_DEFINITION_MAX,
  DICTIONARY_TERM_MAX,
  deleteConfirmationLabel,
  type DictionaryFieldErrors,
  type DictionaryFormValues,
} from "@/lib/dictionary/form";
import {
  DICTIONARY_KIND_LABELS,
  DICTIONARY_KINDS,
  DICTIONARY_STYLES,
  type DictionaryKind,
  type DictionaryStyle,
} from "@/lib/dictionary/types";

type Props = {
  values: DictionaryFormValues;
  errors: DictionaryFieldErrors;
  formError: string | null;
  status: string | null;
  saving: boolean;
  submitLabel: string;
  onChange: (values: DictionaryFormValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
};

const inputClass =
  "min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground";

export function DictionaryDeleteConfirm({
  term,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  term: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="error-alert flex flex-col gap-3" role="alertdialog" aria-labelledby="delete-term-title">
      <p id="delete-term-title" className="text-base font-semibold text-foreground">
        {deleteConfirmationLabel(term)}
      </p>
      {error ? (
        <p className="text-sm font-semibold" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#b94732]/50 px-3 text-sm font-semibold text-accent-profile-text hover:bg-[#b94732]/10 disabled:opacity-70"
        >
          {busy ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="btn-secondary inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-semibold text-foreground disabled:opacity-70"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function DictionaryTermForm({
  values,
  errors,
  formError,
  status,
  saving,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: Props) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const termRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    termRef.current?.focus();
  }, []);

  useEffect(() => {
    const invalid = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']");
    invalid?.focus();
  }, [errors]);

  function update<K extends keyof DictionaryFormValues>(key: K, value: DictionaryFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function toggleStyle(style: DictionaryStyle) {
    const next = values.styles.includes(style)
      ? values.styles.filter((item) => item !== style)
      : [...values.styles, style];
    update("styles", next);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    onSubmit();
  }

  return (
    <form ref={formRef} className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      {formError ? (
        <p className="error-alert text-sm" role="alert">
          {formError}
        </p>
      ) : null}
      {status ? (
        <p className="status-card text-sm font-semibold text-foreground" role="status">
          {status}
        </p>
      ) : null}

      <Field
        id={`${formId}-term`}
        label="Term"
        error={errors.term}
        hint="Required."
      >
        <input
          ref={termRef}
          id={`${formId}-term`}
          name="term"
          type="text"
          required
          maxLength={DICTIONARY_TERM_MAX}
          value={values.term}
          disabled={saving}
          aria-invalid={Boolean(errors.term)}
          aria-describedby={describedBy(formId, "term", Boolean(errors.term))}
          onChange={(event) => update("term", event.target.value)}
          className={inputClass}
        />
      </Field>

      <Field
        id={`${formId}-definition`}
        label="Definition"
        error={errors.definition}
        hint="Required."
      >
        <textarea
          id={`${formId}-definition`}
          name="definition"
          required
          rows={4}
          maxLength={DICTIONARY_DEFINITION_MAX}
          value={values.definition}
          disabled={saving}
          aria-invalid={Boolean(errors.definition)}
          aria-describedby={describedBy(formId, "definition", Boolean(errors.definition))}
          onChange={(event) => update("definition", event.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground"
        />
      </Field>

      <Field id={`${formId}-kind`} label="Type" error={errors.kind} hint="Required.">
        <select
          id={`${formId}-kind`}
          name="kind"
          required
          value={values.kind}
          disabled={saving}
          aria-invalid={Boolean(errors.kind)}
          aria-describedby={describedBy(formId, "kind", Boolean(errors.kind))}
          onChange={(event) => {
            const value = event.target.value;
            update("kind", isKind(value) ? value : "");
          }}
          className={inputClass}
        >
          <option value="">Choose a type</option>
          {DICTIONARY_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {DICTIONARY_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </Field>

      <ListField
        id={`${formId}-aliases`}
        label="Aliases"
        hint="Optional. One alias per line."
        error={errors.aliases}
        value={values.aliases}
        disabled={saving}
        onChange={(value) => update("aliases", value)}
      />

      <fieldset className="flex flex-col gap-2" aria-describedby={describedBy(formId, "styles", Boolean(errors.styles))}>
        <legend className="text-sm font-semibold text-foreground">Broad styles</legend>
        <p id={`${formId}-styles-hint`} className="text-sm text-muted">
          Optional. Indian, Western, or fusion. Other cultural styles belong in the tag field.
        </p>
        <div className="flex flex-col gap-2">
          {DICTIONARY_STYLES.map((style) => (
            <label key={style} className="inline-flex min-h-11 items-center gap-2 text-base text-foreground">
              <input
                type="checkbox"
                name="styles"
                value={style}
                checked={values.styles.includes(style)}
                disabled={saving}
                onChange={() => toggleStyle(style)}
              />
              {style}
            </label>
          ))}
        </div>
        {errors.styles ? (
          <p id={`${formId}-styles-error`} className="error-alert text-sm" role="alert">
            {errors.styles}
          </p>
        ) : null}
      </fieldset>

      <ListField
        id={`${formId}-style-tags`}
        label="Cultural or style tags"
        hint="Optional. One tag per line. These can name styles outside Indian, Western, and fusion."
        error={errors.styleTags}
        value={values.styleTags}
        disabled={saving}
        onChange={(value) => update("styleTags", value)}
      />

      <Field
        id={`${formId}-context`}
        label="Cultural context"
        error={errors.culturalContext}
        hint="Optional. Leave blank to keep this empty."
      >
        <textarea
          id={`${formId}-context`}
          name="cultural_context"
          rows={3}
          maxLength={DICTIONARY_CONTEXT_MAX}
          value={values.culturalContext}
          disabled={saving}
          aria-invalid={Boolean(errors.culturalContext)}
          aria-describedby={describedBy(formId, "context", Boolean(errors.culturalContext))}
          onChange={(event) => update("culturalContext", event.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground"
        />
      </Field>

      <ListField
        id={`${formId}-pairing`}
        label="Pairing suggestions"
        hint="Optional. One suggestion per line."
        error={errors.pairingSuggestions}
        value={values.pairingSuggestions}
        disabled={saving}
        onChange={(value) => update("pairingSuggestions", value)}
      />
      <ListField
        id={`${formId}-occasions`}
        label="Occasions"
        hint="Optional. One occasion per line."
        error={errors.occasions}
        value={values.occasions}
        disabled={saving}
        onChange={(value) => update("occasions", value)}
      />
      <ListField
        id={`${formId}-weather`}
        label="Weather notes"
        hint="Optional. One note per line. These are suggestions, not guarantees."
        error={errors.weatherNotes}
        value={values.weatherNotes}
        disabled={saving}
        onChange={(value) => update("weatherNotes", value)}
      />
      <ListField
        id={`${formId}-comfort`}
        label="Comfort notes"
        hint="Optional. One note per line. These are suggestions, not guarantees."
        error={errors.comfortNotes}
        value={values.comfortNotes}
        disabled={saving}
        onChange={(value) => update("comfortNotes", value)}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="btn-secondary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold text-foreground disabled:opacity-70"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function isKind(value: string): value is DictionaryKind {
  return (DICTIONARY_KINDS as readonly string[]).includes(value);
}

function describedBy(formId: string, field: string, hasError: boolean): string {
  return hasError ? `${formId}-${field}-hint ${formId}-${field}-error` : `${formId}-${field}-hint`;
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <p id={`${id}-hint`} className="text-sm text-muted">
        {hint}
      </p>
      {children}
      {error ? (
        <p id={`${id}-error`} className="error-alert text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ListField({
  id,
  label,
  hint,
  error,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  error?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <p id={`${id}-hint`} className="text-sm text-muted">
        {hint}
      </p>
      <textarea
        id={id}
        name={id}
        rows={3}
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground"
      />
      {error ? (
        <p id={`${id}-error`} className="error-alert text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
