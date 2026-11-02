"use client";

import { useState, useEffect, useRef } from "react";
import type { SignalValue, AltarEntry } from "@/lib/altar-types";
import { todaysDaySign } from "@/lib/chol-qij";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { isValidProvenance, sendSignal, type SignalProvenance } from "@/lib/readingSignal";

const ALTAR_KEY = "elder_altar_record";

function appendToAltar(entry: AltarEntry): void {
  try {
    const raw = localStorage.getItem(ALTAR_KEY);
    const records: AltarEntry[] = raw ? JSON.parse(raw) : [];
    records.push(entry);
    localStorage.setItem(ALTAR_KEY, JSON.stringify(records));
  } catch {
    // silent
  }
}

interface ReadingSignalProps {
  sessionId:   string;
  lineage:     string;
  provenance?: SignalProvenance;
  /** Fired after the tap with the entry that was recorded. */
  onSignal?:   (entry: AltarEntry) => void;
}

/**
 * The closing of a Reading. The seeker is offered three honest answers —
 * "I found myself here", "I need to sit with this", "not mine" — and whichever
 * they give is received with a single word, then silence. Nothing more is
 * asked. "Sitting" is a real answer, not a skipped one: it is recorded, but the
 * learning loop never counts it as a miss (lib/feedbackSteer.ts).
 *
 * The server write happens here, once, on the tap — it is fire-and-forget and
 * can never delay or break the closing (sendSignal swallows every failure).
 */
export default function ReadingSignal({ sessionId, lineage, provenance, onSignal }: ReadingSignalProps) {
  const { t } = useLanguage();
  const [offered,  setOffered]  = useState<SignalValue | null>(null);
  const [rippling, setRippling] = useState(false);
  const [visible,  setVisible]  = useState(false);
  const ripplingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receivedRef   = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 1800);
    return () => {
      clearTimeout(timer);
      if (ripplingTimer.current) clearTimeout(ripplingTimer.current);
    };
  }, []);

  // The three buttons unmount on tap; without this, keyboard and screen-reader
  // focus is dropped to the top of the page right at the closing.
  useEffect(() => {
    if (offered) receivedRef.current?.focus();
  }, [offered]);

  function handleSignal(signal: SignalValue) {
    if (offered) return;
    // The tested Chol Q'ij engine, on the seeker's own calendar day. This used
    // to re-derive the day-sign from UTC-midnight arithmetic, which turned the
    // sign over at 7pm Eastern.
    const day = todaysDaySign();
    const entry: AltarEntry = {
      sessionId,
      timestamp:        new Date().toISOString(),
      nahual:           day.nahual.name,
      trecena:          day.number,
      lineage,
      signal,
      corpusVersion:   provenance?.corpusVersion,
      modelVersion:    provenance?.modelVersion,
      contractVersion: provenance?.contractVersion,
      mode:            "adult_individual",
    };
    if (isValidProvenance(provenance)) {
      appendToAltar(entry);
      sendSignal(entry);
    } else {
      console.warn("[ReadingSignal] Not persisting altar entry — provenance triple missing or unset.", provenance);
    }
    onSignal?.(entry);
    setRippling(true);
    setOffered(signal);
    ripplingTimer.current = setTimeout(() => setRippling(false), 900);
  }

  return (
    <div
      className="elder-signal"
      style={{
        marginTop:     "3rem",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           "1.25rem",
        opacity:       visible ? 1 : 0,
        transition:    "opacity 1.4s ease",
        fontFamily:    "'IM Fell English', 'Palatino Linotype', Georgia, serif",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <style>{`
        @keyframes rippleFade {
          0%   { opacity: 0.3; transform: scale(0.92); }
          40%  { opacity: 1;   transform: scale(1.04); }
          100% { opacity: 1;   transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .elder-signal, .elder-signal * { transition: none !important; animation: none !important; }
        }
      `}</style>

      <div style={{
        width:      "1px",
        height:     "2rem",
        background: "linear-gradient(to bottom, transparent, rgba(200,160,80,0.4), transparent)",
      }} />

      {!offered ? (
        <div
          role="group"
          aria-labelledby="elder-signal-prompt"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem" }}
        >
          <p
            id="elder-signal-prompt"
            style={{
              fontSize:      "var(--control-type-min)",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color:         "var(--ink-readable)",
              margin:        0,
              userSelect:    "none",
              textAlign:     "center",
            }}
          >
            {t('signal.prompt')}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "1rem 2.25rem", alignItems: "flex-start" }}>
            <GlyphButton
              glyph="⊕"
              label={t('signal.landed')}
              title={t('signal.landed_title')}
              onClick={() => handleSignal("landed")}
              color="rgba(220, 170, 70, 0.85)"
              hoverColor="rgba(240, 195, 90, 1)"
            />
            <GlyphButton
              glyph="◐"
              label={t('signal.sitting')}
              title={t('signal.sitting_title')}
              onClick={() => handleSignal("sitting")}
              color="rgba(200, 165, 110, 0.65)"
              hoverColor="rgba(225, 190, 130, 0.95)"
            />
            <GlyphButton
              glyph="◯"
              label={t('signal.passed')}
              title={t('signal.passed_title')}
              onClick={() => handleSignal("did_not_land")}
              color="rgba(180, 160, 140, 0.45)"
              hoverColor="rgba(200, 180, 160, 0.7)"
            />
          </div>
        </div>
      ) : (
        <OfferingReceived
          signal={offered}
          rippling={rippling}
          word={t(CLOSING_KEY[offered])}
          innerRef={receivedRef}
        />
      )}
    </div>
  );
}

const CLOSING_KEY = {
  landed:       'signal.closing_landed',
  sitting:      'signal.closing_sitting',
  did_not_land: 'signal.closing_passed',
} as const;

const GLYPH_COLOR: Record<SignalValue, string> = {
  landed:       "rgba(220,170,70,0.8)",
  sitting:      "rgba(200,165,110,0.7)",
  did_not_land: "rgba(180,160,140,0.5)",
};
const GLYPH_CHAR: Record<SignalValue, string> = {
  landed: "⊕", sitting: "◐", did_not_land: "◯",
};

interface GlyphButtonProps {
  glyph: string; label: string; title: string;
  onClick: () => void; color: string; hoverColor: string;
}

function GlyphButton({ glyph, label, title, onClick, color, hoverColor }: GlyphButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        background: "none", border: "none", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: "0.5rem", padding: "0.5rem", minWidth: 44, minHeight: 44,
        transition: "transform 0.2s ease",
        transform: hovered ? "scale(1.08)" : "scale(1)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize:   "2rem",
          color:      hovered ? hoverColor : color,
          transition: "color 0.3s ease, text-shadow 0.3s ease",
          textShadow: hovered ? `0 0 18px ${hoverColor}, 0 0 40px rgba(220,170,70,0.3)` : "none",
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        {glyph}
      </span>
      <span style={{
        fontSize: "var(--control-type-min)", letterSpacing: "0.18em",
        textTransform: "uppercase", userSelect: "none",
        color: hovered ? "#c4b89a" : "var(--ink-readable)",
        transition: "color 0.3s ease",
      }}>
        {label}
      </span>
    </button>
  );
}

function OfferingReceived({
  signal, rippling, word, innerRef,
}: {
  signal: SignalValue; rippling: boolean; word: string;
  innerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={innerRef}
      role="status"
      tabIndex={-1}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: "0.6rem", outline: "none",
        animation: rippling ? "rippleFade 0.9s ease-out" : undefined,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "1.6rem", color: GLYPH_COLOR[signal] }}>
        {GLYPH_CHAR[signal]}
      </span>
      <p style={{
        fontSize: "var(--control-type-min)", letterSpacing: "0.2em",
        textTransform: "uppercase", margin: 0, userSelect: "none",
        color: "var(--ink-readable)",
      }}>
        {word}
      </p>
    </div>
  );
}
