// components/BankedFire.tsx
//
// THE BANKED FIRE — ceremonial fallback surface.
//
// This is what the seeker sees when the Guardian rejects a reading or when
// the instrument cannot reach the fire. It holds the ceremonial register:
// no error codes, no technical language, no apology. The fire is banked.
// The threshold is closed. The seeker may return when the fire is ready.
//
// It makes no distinction between a guardian rejection (judged failure)
// and an infrastructure failure (degraded API, timeout). The seeker does
// not need to know the difference. The instrument does — see altarRecord.ts.
//
// Design: quiet and self-contained. The ember glyph anchors the moment.
// The language is declarative, not apologetic. A single action: step back
// from the threshold. The component is deliberately minimal — it must hold
// even if the FireAtmosphere behind it is also degraded.

"use client";

import React, { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Copy — held in ceremonial register. Not "error", not "unavailable".
// ─────────────────────────────────────────────────────────────────────────────

const TITLE = "The fire is banked.";

const BODY =
  "The threshold is closed at this hour. The voice has not yet crossed. " +
  "Return when the fire is ready.";

const ACTION_LABEL = "Step back from the threshold";

// The ember glyph used elsewhere in the instrument as a liminal marker.
const EMBER = "⟡";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface BankedFireProps {
  /**
   * Called when the seeker dismisses the state and returns to the threshold.
   * The parent (Threshold.tsx) should reset to the appropriate prior phase
   * rather than advancing past it.
   */
  onReturn: () => void;

  /**
   * Optional: pass "infrastructure" to render a slightly different subtext
   * without ever exposing the technical term to the seeker. Still ceremonial.
   * Defaults to the standard copy for all rejection types.
   */
  failureMode?: "judged" | "infrastructure";
}

// ─────────────────────────────────────────────────────────────────────────────
// Alternate body copy for infrastructure failure — same register, slightly
// different: "the fire has gone quiet" rather than "not yet crossed."
// ─────────────────────────────────────────────────────────────────────────────

const BODY_INFRASTRUCTURE =
  "The fire has gone quiet. The threshold holds, but the voice cannot cross " +
  "at this hour. The instrument is tending the hearth. Return when the fire speaks.";

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function BankedFire({ onReturn, failureMode }: BankedFireProps) {
  const [visible, setVisible] = useState(false);

  // Fade in on mount — gives the transition weight without jarring.
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const body = failureMode === "infrastructure" ? BODY_INFRASTRUCTURE : BODY;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="The threshold is closed. The fire is banked."
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 1.4s ease",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "var(--elder-space-xl, 3rem) var(--elder-space-lg, 2rem)",
        textAlign: "center",
        // Falls back gracefully if elder-tokens.ts tokens are not yet in scope.
        fontFamily: "var(--elder-font-body, Georgia, serif)",
        color: "var(--elder-color-ash, #c8bfb0)",
        background: "transparent",
      }}
    >
      {/* Ember glyph — the banked state marker */}
      <span
        aria-hidden="true"
        style={{
          display: "block",
          fontSize: "var(--elder-size-glyph-lg, 2.2rem)",
          color: "var(--elder-color-ember, #8b5e3c)",
          marginBottom: "var(--elder-space-md, 1.5rem)",
          opacity: 0.7,
          // Slow pulse: present but not urgent.
          animation: "banked-ember-pulse 4s ease-in-out infinite",
        }}
      >
        {EMBER}
      </span>

      {/* Title */}
      <h2
        style={{
          fontFamily: "var(--elder-font-display, Georgia, serif)",
          fontSize: "var(--elder-size-heading-sm, 1.4rem)",
          fontWeight: 400,
          letterSpacing: "0.08em",
          color: "var(--elder-color-bone, #e8e0d4)",
          margin: "0 0 var(--elder-space-md, 1.5rem) 0",
          lineHeight: 1.3,
        }}
      >
        {TITLE}
      </h2>

      {/* Body */}
      <p
        style={{
          fontSize: "var(--elder-size-body, 1rem)",
          lineHeight: 1.8,
          maxWidth: "38ch",
          margin: "0 0 var(--elder-space-xl, 3rem) 0",
          opacity: 0.75,
        }}
      >
        {body}
      </p>

      {/* Return action */}
      <button
        onClick={onReturn}
        style={{
          background: "transparent",
          border: "1px solid var(--elder-color-ember, #8b5e3c)",
          color: "var(--elder-color-ash, #c8bfb0)",
          fontFamily: "var(--elder-font-body, Georgia, serif)",
          fontSize: "var(--elder-size-caption, 0.85rem)",
          letterSpacing: "0.12em",
          padding: "0.75rem 2rem",
          cursor: "pointer",
          opacity: 0.8,
          transition: "opacity 0.3s ease, border-color 0.3s ease",
          // No border-radius — the instrument is not a wellness app.
          borderRadius: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--elder-color-bone, #e8e0d4)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "0.8";
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--elder-color-ember, #8b5e3c)";
        }}
      >
        {ACTION_LABEL}
      </button>

      {/* Keyframe — injected once per mount */}
      <style>{`
        @keyframes banked-ember-pulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 0.85; }
        }
        @media (prefers-reduced-motion: reduce) {
          .banked-fire-ember { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

export default BankedFire;
