"use client";

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "../../lib/i18n/LanguageContext";

type MarkerField = "wound" | "figure" | "threshold" | "exile" | "pattern";

type OfferState =
  | { phase: "loading" }
  | { phase: "none" }
  | { phase: "offered"; field: MarkerField; offer: string; reflection: string | null }
  | { phase: "reshaping"; field: MarkerField; offer: string }
  | { phase: "done"; mode: "confirmed" | "reshaped" | "declined" | "already_recorded" };

interface MarkerOfferProps {
  visitId: string;
}

/**
 * §1.5 marker co-authorship, the UI half. The extractor proposes a marker
 * (POST /api/elder/marker-offer); the seeker confirms, reshapes, or
 * declines it (POST /api/elder/confirm-marker). Only what the seeker
 * assents to ever counts toward Axis 2's appearance floor -- see
 * docs/axis-2-marker-trajectory.md. Mirrors ReadingSignal.tsx's mount-after-
 * a-beat, fade-in aesthetic since it occupies the same resting-state slot.
 */
export default function MarkerOffer({ visitId }: MarkerOfferProps) {
  const { t, languageName } = useLanguage();
  const [state, setState] = useState<OfferState>({ phase: "loading" });
  const [visible, setVisible] = useState(false);
  const [reshapeWords, setReshapeWords] = useState("");
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fetchedFor.current === visitId) return;
    fetchedFor.current = visitId;
    (async () => {
      try {
        const res = await fetch("/api/elder/marker-offer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitId, languageName }),
        });
        const data = await res.json();
        if (!res.ok || !data.offer) {
          setState({ phase: "none" });
          return;
        }
        setState({
          phase: "offered",
          field: data.field,
          offer: data.offer,
          reflection: data.reflectionCounts
            ? t('marker.reflection', { total: data.reflectionCounts.total, carried: data.reflectionCounts.carried })
            : (data.reflection ?? null),
        });
      } catch {
        setState({ phase: "none" });
      }
    })();
  }, [visitId]);

  async function respond(field: MarkerField, response: { type: "confirm" | "reshape" | "decline"; words?: string }) {
    try {
      const res = await fetch("/api/elder/confirm-marker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId, field, response }),
      });
      const data = await res.json();
      if (!res.ok) {
        // welfare_crisis / welfare_distress / bad_request -- fail toward
        // silence, same posture as the offer route itself.
        setState({ phase: "none" });
        return;
      }
      setState({ phase: "done", mode: data.mode });
    } catch {
      setState({ phase: "none" });
    }
  }

  if (state.phase === "loading" || state.phase === "none") return null;

  return (
    <div
      style={{
        marginTop: "2.25rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
        opacity: visible ? 1 : 0,
        transition: "opacity 1.4s ease",
        fontFamily: "'IM Fell English', 'Palatino Linotype', Georgia, serif",
        pointerEvents: visible ? "auto" : "none",
        maxWidth: 460,
        margin: "2.25rem auto 0",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "1px",
          height: "1.5rem",
          background: "linear-gradient(to bottom, transparent, rgba(200,160,80,0.35), transparent)",
        }}
      />

      {(state.phase === "offered" || state.phase === "reshaping") && (
        <>
          <p
            style={{
              fontStyle: "italic",
              color: "rgba(230, 200, 150, 0.82)",
              fontSize: "0.95rem",
              lineHeight: 1.75,
              margin: 0,
            }}
          >
            {state.offer}
          </p>
          {state.phase === "offered" && state.reflection && (
            <p
              style={{
                fontSize: "0.68rem",
                letterSpacing: "0.05em",
                color: "rgba(210, 175, 100, 0.45)",
                fontStyle: "italic",
                margin: 0,
              }}
            >
              {state.reflection}
            </p>
          )}

          {state.phase === "offered" && (
            <div style={{ display: "flex", gap: "1.75rem", marginTop: "0.25rem" }}>
              <MarkerButton label={t('marker.yes')} onClick={() => respond(state.field, { type: "confirm" })} />
              <MarkerButton label={t('marker.my_way')} onClick={() => setState({ phase: "reshaping", field: state.field, offer: state.offer })} />
              <MarkerButton label={t('marker.not_this')} onClick={() => respond(state.field, { type: "decline" })} muted />
            </div>
          )}

          {state.phase === "reshaping" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", width: "100%" }}>
              <textarea
                value={reshapeWords}
                onChange={(e) => setReshapeWords(e.target.value.slice(0, 300))}
                placeholder={t('marker.placeholder')}
                rows={3}
                style={{
                  width: "100%",
                  background: "rgba(8,6,4,0.6)",
                  border: "1px solid rgba(212,168,67,0.28)",
                  color: "rgba(230, 200, 150, 0.9)",
                  fontFamily: "inherit",
                  fontSize: "0.85rem",
                  fontStyle: "italic",
                  padding: "10px 14px",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: "1.5rem" }}>
                <MarkerButton
                  label={t('marker.offer_this')}
                  onClick={() => reshapeWords.trim() && respond(state.field, { type: "reshape", words: reshapeWords.trim() })}
                />
                <MarkerButton label={t('marker.never_mind')} onClick={() => setState({ phase: "offered", field: state.field, offer: state.offer, reflection: null })} muted />
              </div>
            </div>
          )}
        </>
      )}

      {state.phase === "done" && (
        <p
          style={{
            fontSize: "0.68rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(210,175,100,0.4)",
            margin: 0,
          }}
        >
          {state.mode === "confirmed" && t('marker.held')}
          {state.mode === "reshaped" && t('marker.reshaped')}
          {state.mode === "declined" && t('marker.declined')}
          {state.mode === "already_recorded" && t('marker.already')}
        </p>
      )}
    </div>
  );
}

function MarkerButton({ label, onClick, muted }: { label: string; onClick: () => void; muted?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontStyle: "italic",
        fontSize: "0.78rem",
        letterSpacing: "0.03em",
        padding: "0.3rem 0",
        color: hovered
          ? "rgba(240,195,90,1)"
          : muted
          ? "rgba(180,160,140,0.45)"
          : "rgba(210,175,100,0.65)",
        transition: "color 0.25s ease",
      }}
    >
      {label}
    </button>
  );
}
