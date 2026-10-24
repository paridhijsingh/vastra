"use client";

import Image from "next/image";
import { useEffect, useId, useRef, type CSSProperties } from "react";

import { useEntrance } from "@/lib/studio/entrance-context";

/** Shared art canvas: frame + doors are the same pixel size and overlay 1:1. */
const WARDROBE = {
  scene: "/home/entrance-scene.jpg",
  frame: "/home/wardrobe-frame-v2.png",
  doorLeft: "/home/wardrobe-door-left-v3.png",
  doorRight: "/home/wardrobe-door-right-v3.png",
  width: 768,
  height: 1079,
  opening: {
    top: "8.6191%",
    right: "10.6771%",
    bottom: "28.7303%",
    left: "12.7604%",
  },
  hingeLeft: "12.7604%",
  hingeRight: "89.3229%",
  hingeY: "39.9444%",
} as const;

type AssemblyVars = CSSProperties & {
  "--open-top": string;
  "--open-right": string;
  "--open-bottom": string;
  "--open-left": string;
  "--hinge-left": string;
  "--hinge-right": string;
  "--hinge-y": string;
};

export function WardrobeEntrance() {
  const { visible, swinging, openDoors, skipIntro } = useEntrance();
  const titleId = useId();
  const openRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (visible && !swinging) {
      openRef.current?.focus();
    }
  }, [visible, swinging]);

  if (!visible) return null;

  const assemblyStyle: AssemblyVars = {
    aspectRatio: `${WARDROBE.width} / ${WARDROBE.height}`,
    "--open-top": WARDROBE.opening.top,
    "--open-right": WARDROBE.opening.right,
    "--open-bottom": WARDROBE.opening.bottom,
    "--open-left": WARDROBE.opening.left,
    "--hinge-left": WARDROBE.hingeLeft,
    "--hinge-right": WARDROBE.hingeRight,
    "--hinge-y": WARDROBE.hingeY,
  };

  return (
    <div
      className={["wardrobe-entrance", swinging ? "is-opening" : ""].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <Image
        src={WARDROBE.scene}
        alt=""
        fill
        priority
        quality={90}
        sizes="100vw"
        className="wardrobe-scene-art"
        aria-hidden="true"
      />

      <button type="button" className="wardrobe-skip" onClick={skipIntro}>
        Skip intro
      </button>

      <div className="wardrobe-assembly" style={assemblyStyle}>
        <Image
          src={WARDROBE.frame}
          alt=""
          fill
          priority
          quality={90}
          sizes="(max-width: 768px) 96vw, 36rem"
          className="wardrobe-frame-art"
          aria-hidden="true"
        />
        <span className="wardrobe-door wardrobe-door-left" aria-hidden="true">
          <Image
            src={WARDROBE.doorLeft}
            alt=""
            fill
            priority
            quality={90}
            sizes="(max-width: 768px) 96vw, 36rem"
            className="wardrobe-door-art"
          />
          <span className="wardrobe-handle-glow" />
        </span>
        <span className="wardrobe-door wardrobe-door-right" aria-hidden="true">
          <Image
            src={WARDROBE.doorRight}
            alt=""
            fill
            priority
            quality={90}
            sizes="(max-width: 768px) 96vw, 36rem"
            className="wardrobe-door-art"
          />
          <span className="wardrobe-handle-glow" />
        </span>
        <button
          ref={openRef}
          type="button"
          className="wardrobe-open"
          aria-label="Open your wardrobe"
          disabled={swinging}
          onClick={openDoors}
        >
          <span className="wardrobe-plaque" aria-hidden="true">
            Open your wardrobe
          </span>
        </button>
      </div>

      <p id={titleId} className={["wardrobe-copy", swinging ? "opacity-0" : "opacity-100"].join(" ")}>
        Vastra · वस्त्र
      </p>
    </div>
  );
}
