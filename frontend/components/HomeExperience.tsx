"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { TryDemoButton } from "@/components/TryDemoButton";
import { HOW_IT_WORKS_INTRO, HOW_IT_WORKS_MODELS } from "@/lib/ai";
import { HOME_FLOW_CARDS, HOME_HEADLINE, HOME_PROBLEM } from "@/lib/home/hero";
import {
  HOME_PIN_HINT,
  HOME_ROOM_ALT,
  HOME_ROOM_PORTRAIT,
  HOME_ROOM_WIDE,
  HOME_TUTORIAL_STEPS,
  TUTORIAL_STORAGE_KEY,
  accentDotClass,
  accentTextClass,
  hotspotById,
  hotspotsForViewport,
} from "@/lib/home/room";
import { useEntrance } from "@/lib/studio/entrance-context";

type Props = {
  signedIn?: boolean;
};

export function HomeExperience({ signedIn = false }: Props) {
  const { replayEntrance } = useEntrance();
  const tutorialTitleId = useId();
  const [portrait, setPortrait] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(max-aspect-ratio: 3/4)");
    const apply = () => setPortrait(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (localStorage.getItem(TUTORIAL_STORAGE_KEY) !== "1") {
      setTutorialOpen(true);
    }
  }, []);

  const hotspots = hotspotsForViewport(portrait);
  const art = portrait ? HOME_ROOM_PORTRAIT : HOME_ROOM_WIDE;
  const step = HOME_TUTORIAL_STEPS[tutorialStep];
  const preview = hotspotById(previewId ?? (tutorialOpen ? step?.hotspotId : null), portrait);

  function closeTutorial() {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
    setTutorialOpen(false);
  }

  function nextTutorial() {
    if (tutorialStep >= HOME_TUTORIAL_STEPS.length - 1) {
      closeTutorial();
      return;
    }
    const next = tutorialStep + 1;
    setTutorialStep(next);
    setPreviewId(HOME_TUTORIAL_STEPS[next]?.hotspotId ?? null);
  }

  return (
    <div className="home-studio">
      <section className="home-hero" aria-labelledby="home-headline">
        <h1 id="home-headline" className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {HOME_HEADLINE}
        </h1>
        <p className="max-w-2xl text-base text-muted sm:text-lg">{HOME_PROBLEM}</p>
        <ul className="home-flow-grid">
          {HOME_FLOW_CARDS.map((card) => (
            <li key={card.href}>
              <Link href={card.href} className="home-flow-card">
                <span className="font-display text-lg font-semibold text-foreground">{card.title}</span>
                <span className="text-sm text-muted">{card.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
        {signedIn ? null : (
          <TryDemoButton className="btn-primary inline-flex min-h-12 w-full items-center justify-center rounded-md px-5 text-base font-semibold sm:w-auto disabled:cursor-not-allowed disabled:opacity-70" />
        )}
      </section>

      <div className={portrait ? "home-art home-art-portrait" : "home-art home-art-wide"}>
        <Image
          src={art.src}
          alt={HOME_ROOM_ALT}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <ul className="absolute inset-0" aria-label="Dressing room shortcuts">
          {hotspots.map((hotspot) => {
            const isSelected = preview?.id === hotspot.id;
            return (
              <li key={hotspot.id}>
                <Link
                  href={hotspot.href}
                  aria-label={`${hotspot.label}, ${hotspot.object}`}
                  onFocus={() => setPreviewId(hotspot.id)}
                  onMouseEnter={() => setPreviewId(hotspot.id)}
                  className={[
                    "home-pin",
                    isSelected ? "is-selected" : "",
                    tutorialOpen && preview && !isSelected ? "opacity-40" : "",
                  ].join(" ")}
                  style={{ left: `${hotspot.left}%`, top: `${hotspot.top}%` }}
                >
                  <span className="home-pin-label">
                    <span className={["h-2.5 w-2.5 shrink-0 rounded-full", accentDotClass(hotspot.accent)].join(" ")} aria-hidden="true" />
                    <span className={["truncate text-xs font-semibold", accentTextClass(hotspot.accent)].join(" ")}>
                      {hotspot.label}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="home-panel text-sm text-muted sm:text-base">{HOME_PIN_HINT}</p>

      <footer className="home-how">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-accent-wardrobe-text">How it works</p>
        <p className="mt-1 text-sm text-foreground">{HOW_IT_WORKS_INTRO}</p>
        <ul className="mt-2 flex min-w-0 flex-col gap-1 text-sm text-muted">
          {HOW_IT_WORKS_MODELS.map((model) => (
            <li key={model.tier}>
              <span className="font-semibold text-foreground">Nemotron {model.tier}</span>
              {` — ${model.use}, via Nebius Token Factory.`}
            </li>
          ))}
        </ul>
      </footer>

      {tutorialOpen ? (
        <TutorialPanel
          titleId={tutorialTitleId}
          stepIndex={tutorialStep}
          onSkip={closeTutorial}
          onNext={nextTutorial}
          onReplay={replayEntrance}
        />
      ) : null}
    </div>
  );
}

function TutorialPanel({
  titleId,
  stepIndex,
  onSkip,
  onNext,
  onReplay,
}: {
  titleId: string;
  stepIndex: number;
  onSkip: () => void;
  onNext: () => void;
  onReplay: () => void;
}) {
  const step = HOME_TUTORIAL_STEPS[stepIndex];
  const isLast = stepIndex === HOME_TUTORIAL_STEPS.length - 1;
  return (
    <div className="home-tour" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-wardrobe-text">
        Navigation tip {stepIndex + 1} of {HOME_TUTORIAL_STEPS.length}
      </p>
      <h2 id={titleId} className="mt-1 font-display text-xl font-semibold text-foreground">
        {step.title}
      </h2>
      <p className="mt-1 text-sm text-muted sm:text-base">{step.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onReplay} className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold">
          Replay entrance
        </button>
        <button type="button" onClick={onSkip} className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-3 text-sm font-semibold">
          Skip
        </button>
        <button type="button" onClick={onNext} className="btn-primary inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold">
          {isLast ? "Start exploring" : "Next tip"}
        </button>
      </div>
    </div>
  );
}
