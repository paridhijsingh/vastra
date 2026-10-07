"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Mode = "register" | "signin";

type Props = {
  mode: Mode;
  nextPath?: string;
  initialMessage?: string;
};

export function AuthForm({ mode, nextPath = "/", initialMessage }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(initialMessage ?? null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setError(null);
    setInfo(null);

    const trimmedUsername = username.trim();
    if (mode === "register") {
      if (trimmedUsername.length < 3) {
        setError("Username must be at least 3 characters.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
    } else if (!trimmedUsername || !password) {
      setError("Enter your username and password.");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint =
        mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ username: trimmedUsername, password }),
      });

      let payload: { error?: string; user?: { username: string } } = {};
      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        payload = {};
      }

      if (!response.ok) {
        setError(
          payload.error ??
            (response.status === 503
              ? "The authentication service is unavailable. Please try again later."
              : "Something went wrong. Please try again."),
        );
        return;
      }

      if (mode === "register") {
        router.push("/signin?registered=1");
        router.refresh();
        return;
      }

      router.push(nextPath.startsWith("/") ? nextPath : "/");
      router.refresh();
    } catch {
      setError(
        "The authentication service is unavailable. Please try again later.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "register" ? "Create an account" : "Sign in";
  const submitLabel =
    mode === "register"
      ? submitting
        ? "Creating account…"
        : "Create account"
      : submitting
        ? "Signing in…"
        : "Sign in";

  return (
    <div className="flex max-w-md min-w-0 flex-col gap-5">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="text-base text-muted">
        {mode === "register"
          ? "Choose a username and password. You will sign in after registering."
          : "Sign in to access your Style Profile and Wardrobe."}
      </p>

      {info ? (
        <p
          className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-foreground"
          role="status"
        >
          {info}
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

      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="username" className="text-sm font-semibold text-foreground">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            minLength={mode === "register" ? 3 : 1}
            maxLength={64}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={submitting}
            className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-semibold text-foreground">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
            minLength={mode === "register" ? 8 : 1}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            className="min-h-12 rounded-md border border-border bg-surface px-3 text-base text-foreground"
          />
        </div>

        <button
          type="submit"
          className="btn-primary inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70"
          disabled={submitting}
        >
          {submitLabel}
        </button>
      </form>

      <p className="text-sm text-muted">
        {mode === "register" ? (
          <>
            Already have an account?{" "}
            <Link href="/signin" className="font-semibold text-foreground underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            Need an account?{" "}
            <Link href="/register" className="font-semibold text-foreground underline">
              Register
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
