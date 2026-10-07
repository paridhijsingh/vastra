"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  EMPTY_PROFILE,
  PREFERRED_STYLES,
  STYLING_PREFERENCES,
  linesToList,
  listToLines,
  type PreferredStyle,
  type ProfilePayload,
  type ProfilePublic,
  type StylingPreference,
} from "@/lib/profile/types";

type LoadState = "loading" | "ready" | "error";

function payloadFromProfile(profile: ProfilePublic | null): ProfilePayload {
  if (!profile) {
    return { ...EMPTY_PROFILE };
  }
  return {
    styling_preference: profile.styling_preference,
    preferred_styles: [...profile.preferred_styles],
    preferred_colors: [...profile.preferred_colors],
    fit_preferences: [...profile.fit_preferences],
    comfort_preferences: [...profile.comfort_preferences],
    clothing_to_avoid: [...profile.clothing_to_avoid],
  };
}

export function ProfileForm() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [exists, setExists] = useState(false);
  const [stylingPreference, setStylingPreference] =
    useState<StylingPreference>(EMPTY_PROFILE.styling_preference);
  const [preferredStyles, setPreferredStyles] = useState<PreferredStyle[]>([]);
  const [preferredColorsText, setPreferredColorsText] = useState("");
  const [fitText, setFitText] = useState("");
  const [comfortText, setComfortText] = useState("");
  const [avoidText, setAvoidText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function applyPayload(payload: ProfilePayload, profileExists: boolean) {
    setExists(profileExists);
    setStylingPreference(payload.styling_preference);
    setPreferredStyles([...payload.preferred_styles]);
    setPreferredColorsText(listToLines(payload.preferred_colors));
    setFitText(listToLines(payload.fit_preferences));
    setComfortText(listToLines(payload.comfort_preferences));
    setAvoidText(listToLines(payload.clothing_to_avoid));
  }

  function clearToEmptyState() {
    applyPayload({ ...EMPTY_PROFILE }, false);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadState("loading");
      setError(null);
      setSuccess(null);
      try {
        const response = await fetch("/api/profile", {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const body = (await response.json().catch(() => ({}))) as {
          profile?: ProfilePublic | null;
          error?: string;
          kind?: string;
        };

        if (cancelled) return;

        if (response.status === 401) {
          setError(body.error ?? "Your session has expired. Please sign in again.");
          setLoadState("error");
          router.push("/signin?next=/profile");
          router.refresh();
          return;
        }

        if (!response.ok) {
          setError(
            body.error ??
              (response.status === 503
                ? "The profile service is unavailable. Please try again later."
                : "Could not load your profile. Please try again."),
          );
          setLoadState("error");
          return;
        }

        const profile = body.profile ?? null;
        applyPayload(payloadFromProfile(profile), profile !== null);
        setLoadState("ready");
      } catch {
        if (!cancelled) {
          setError(
            "The profile service is unavailable. Please try again later.",
          );
          setLoadState("error");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function toggleStyle(style: PreferredStyle) {
    setPreferredStyles((current) =>
      current.includes(style)
        ? current.filter((item) => item !== style)
        : [...current, style],
    );
  }

  function buildPayload(): ProfilePayload {
    return {
      styling_preference: stylingPreference,
      preferred_styles: preferredStyles,
      preferred_colors: linesToList(preferredColorsText),
      fit_preferences: linesToList(fitText),
      comfort_preferences: linesToList(comfortText),
      clothing_to_avoid: linesToList(avoidText),
    };
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || deleting) return;

    setError(null);
    setSuccess(null);
    setSaving(true);

    const payload = buildPayload();

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as {
        profile?: ProfilePublic;
        error?: string;
      };

      if (response.status === 401) {
        setError(body.error ?? "Your session has expired. Please sign in again.");
        router.push("/signin?next=/profile");
        router.refresh();
        return;
      }

      if (!response.ok) {
        // Preserve unsaved input — do not reset fields.
        setError(
          body.error ??
            (response.status === 503
              ? "The profile service is unavailable. Please try again later."
              : "Could not save your profile. Please try again."),
        );
        return;
      }

      if (body.profile) {
        applyPayload(payloadFromProfile(body.profile), true);
      } else {
        setExists(true);
      }
      setSuccess("Profile saved.");
      router.refresh();
    } catch {
      setError("The profile service is unavailable. Please try again later.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (saving || deleting) return;
    const confirmed = window.confirm(
      "Delete your style profile? This cannot be undone.",
    );
    if (!confirmed) return;

    setError(null);
    setSuccess(null);
    setDeleting(true);

    try {
      const response = await fetch("/api/profile", {
        method: "DELETE",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (response.status === 401) {
        setError(body.error ?? "Your session has expired. Please sign in again.");
        router.push("/signin?next=/profile");
        router.refresh();
        return;
      }

      if (!response.ok) {
        setError(
          body.error ??
            (response.status === 503
              ? "The profile service is unavailable. Please try again later."
              : "Could not delete your profile. Please try again."),
        );
        return;
      }

      clearToEmptyState();
      setSuccess("Profile deleted.");
      router.refresh();
    } catch {
      setError("The profile service is unavailable. Please try again later.");
    } finally {
      setDeleting(false);
    }
  }

  if (loadState === "loading") {
    return (
      <p className="rounded-md border border-border bg-surface px-4 py-4 text-base text-muted" role="status">
        Loading your style profile…
      </p>
    );
  }

  const busy = saving || deleting;

  return (
    <div className="flex max-w-2xl min-w-0 flex-col gap-5">
      {!exists ? (
        <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted" role="status">
          No saved profile yet. Fill in your preferences and save to create one.
        </p>
      ) : null}

      {success ? (
        <p
          className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-foreground"
          role="status"
        >
          {success}
        </p>
      ) : null}

      {error ? (
        <p
          className="rounded-md border border-[#b94732]/40 bg-[#b94732]/10 px-4 py-3 text-sm text-accent-profile-text"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <form className="flex flex-col gap-6" onSubmit={onSave} noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="styling_preference" className="text-sm font-semibold text-foreground">
            Styling preference
          </label>
          <select
            id="styling_preference"
            name="styling_preference"
            value={stylingPreference}
            disabled={busy}
            onChange={(event) =>
              setStylingPreference(event.target.value as StylingPreference)
            }
            className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
          >
            {STYLING_PREFERENCES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="flex flex-col gap-2" disabled={busy}>
          <legend className="text-sm font-semibold text-foreground">
            Preferred styles
          </legend>
          <p className="text-sm text-muted">
            Select any combination of Indian, Western, and fusion. Leave all unchecked for none.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
            {PREFERRED_STYLES.map((style) => (
              <label key={style} className="inline-flex min-h-11 items-center gap-2 text-base text-foreground">
                <input
                  type="checkbox"
                  name="preferred_styles"
                  value={style}
                  checked={preferredStyles.includes(style)}
                  onChange={() => toggleStyle(style)}
                  className="h-4 w-4"
                />
                {style}
              </label>
            ))}
          </div>
        </fieldset>

        <TextListField
          id="preferred_colors"
          label="Preferred colors"
          hint="Enter one color per line. Leave blank for none."
          value={preferredColorsText}
          disabled={busy}
          onChange={setPreferredColorsText}
        />
        <TextListField
          id="fit_preferences"
          label="Fit preferences"
          hint="Enter one fit preference per line. Leave blank for none."
          value={fitText}
          disabled={busy}
          onChange={setFitText}
        />
        <TextListField
          id="comfort_preferences"
          label="Comfort preferences"
          hint="Enter one comfort preference per line. Leave blank for none."
          value={comfortText}
          disabled={busy}
          onChange={setComfortText}
        />
        <TextListField
          id="clothing_to_avoid"
          label="Clothing to avoid"
          hint="Enter one item to avoid per line. Leave blank for none."
          value={avoidText}
          disabled={busy}
          onChange={setAvoidText}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            className="btn-primary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70"
            disabled={busy}
          >
            {saving ? "Saving…" : exists ? "Save profile" : "Create profile"}
          </button>
          {exists ? (
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={busy}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#b94732]/50 px-5 text-base font-semibold text-accent-profile-text transition-colors hover:bg-[#b94732]/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {deleting ? "Deleting…" : "Delete profile"}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function TextListField({
  id,
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <p className="text-sm text-muted">{hint}</p>
      <textarea
        id={id}
        name={id}
        rows={4}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground"
      />
    </div>
  );
}
