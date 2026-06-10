"use client";

import { useState, useEffect, useRef } from "react";
import type { SignalValue, AltarEntry } from "@/lib/altar-types";
import { NAHUALES } from "@/lib/nahuales";

const ANCHOR_MS      = new Date("2020-04-22").getTime();
const ANCHOR_NAHUAL  = 18;
const ANCHOR_TRECENA = 5;

function getTodayNahual(): { name: string; trecena: number } {
  const days    = Math.floor((Date.now() - ANCHOR_MS) / 86400000);
  const idx     = ((ANCHOR_NAHUAL + days) % 20 + 20) % 20;
  const trecena = ((ANCHOR_TRECENA - 1 + days) % 13 + 13) % 13 + 1;
  return { name: NAHUALES[idx].name, trecena };
}

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
  provenance?: { corpusVersion?: string; modelVersion?: string; contractVersion?: string };
  onSignal?:   (entry: AltarEntry) => void;
}

export default function ReadingSignal({ sessionId, lineage, provenance, onSignal }: ReadingSignalProps) {
  const [offered,  setOffered]  = useState<SignalValue | null>(null);
  const [rippling, setRippling] = useState(false);
  const [visible,  setVisible]  = useState(false);
  const ripplingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 1800);
    return () => {
      clearTimeout(timer);
      if (ripplingTimer.current) clearTimeout(ripplingTimer.current);
    };
  }, []);

  function handleSignal(signal: SignalValue) {
    if (offered) return;
    const { name, trecena } = getTodayNahual();
    const entry: AltarEntry = {
      sessionId,
      timestamp:        new Date().toISOString(),
      nahual:           name,
      trecena,
      lineage,
      signal,
      corpusVersion:   provenance?.corpusVersion,
      modelVersion:    provenance?.modelVersion,
      contractVersion: provenance?.contractVersion,
      mode:            "adult_individual",
    };
    appendToAltar(entry);
    onSignal?.(entry);
    setRippling(true);
    setOffered(signal);
    ripplingTimer.current = setTimeout(() => setRippling(false), 900);
  }

  return (
    <div style={{
      marginTop:     "3rem",
      display:       "flex",
      flexDirection: "column",
      alignItems:    "center",
      gap:           "1.25rem",
      opacity:       visible ? 1 : 0,
      transition:    "opacity 1.4s ease",
      fontFamily:    "'IM Fell English', 'Palatino Linotype', Georgia, serif",
      pointerEvents: visible ? "auto" : "none",
    }}>
      <div style={{
        width:      "1px",
        height:     "2rem",
        background: "linear-gradient(to bottom, transparent, rgba(200,160,80,0.4), transparent)",
      }} />

      {!offered && (
        <p style={{
          fontSize:      "0.72rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color:         "rgba(210, 175, 100, 0.55)",
          margin:        0,
          userSelect:    "none",
        }}>
          did the fire find you
        </p>
      )}

      {!offered ? (
        <div style={{ display: "flex", gap: "3.5rem", alignItems: "center" }}>
          <GlyphButton
            glyph="&#8853;"
            label="landed"
            title="The Reading found me"
            onClick={() => handleSignal("landed")}
            color="rgba(220, 170, 70, 0.85)"
            hoverColor="rgba(240, 195, 90, 1)"
          />
          <GlyphButton
            glyph="&#9711;"
            label="passed through"
            title="The Reading did not land"
            onClick={() => handleSignal("did_not_land")}
            color="rgba(180, 160, 140, 0.45)"
            hoverColor="rgba(200, 180, 160, 0.7)"
          />
        </div>
      ) : (
        <OfferingReceived signal={offered} rippling={rippling} />
      )}
    </div>
  );
}

interface GlyphButtonProps {
  glyph: string; label: string; title: string;
  onClick: () => void; color: string; hoverColor: string;
}

function GlyphButton({ glyph, label, title, onClick, color, hoverColor }: GlyphButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "none", border: "none", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: "0.5rem", padding: "0.5rem",
        transition: "transform 0.2s ease",
        transform: hovered ? "scale(1.08)" : "scale(1)",
      }}
    >
      <span
        style={{
          fontSize:   "2rem",
          color:      hovered ? hoverColor : color,
          transition: "color 0.3s ease, text-shadow 0.3s ease",
          textShadow: hovered ? `0 0 18px ${hoverColor}, 0 0 40px rgba(220,170,70,0.3)` : "none",
          lineHeight: 1,
          userSelect: "none",
        }}
        dangerouslySetInnerHTML={{ __html: glyph }}
      />
      <span style={{
        fontSize: "0.6rem", letterSpacing: "0.18em",
        textTransform: "uppercase", userSelect: "none",
        color: hovered ? "rgba(210,175,100,0.6)" : "rgba(210,175,100,0.25)",
        transition: "color 0.3s ease",
      }}>
        {label}
      </span>
    </button>
  );
}

function OfferingReceived({ signal, rippling }: { signal: SignalValue; rippling: boolean }) {
  const isLanded = signal === "landed";
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: "0.6rem",
      animation: rippling ? "rippleFade 0.9s ease-out" : undefined,
    }}>
      <style>{`
        @keyframes rippleFade {
          0%   { opacity: 0.3; transform: scale(0.92); }
          40%  { opacity: 1;   transform: scale(1.04); }
          100% { opacity: 1;   transform: scale(1); }
        }
      `}</style>
      <span
        style={{ fontSize: "1.6rem", color: isLanded ? "rgba(220,170,70,0.8)" : "rgba(180,160,140,0.5)" }}
        dangerouslySetInnerHTML={{ __html: isLanded ? "&#8853;" : "&#9711;" }}
      />
      <p style={{
        fontSize: "0.65rem", letterSpacing: "0.2em",
        textTransform: "uppercase", margin: 0, userSelect: "none",
        color: "rgba(210,175,100,0.35)",
      }}>
        {isLanded ? "received" : "recorded"}
      </p>
    </div>
  );
}
