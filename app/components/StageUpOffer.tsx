"use client";

import { useState, useEffect } from "react";

type DepthStage = "surface" | "confronted" | "integrated";

interface PendingStageUp {
  trajectoryId: number;
  markerType: string;
  markerValue: string;
  pendingStage: DepthStage;
}

type OfferState =
  | { phase: "offered"; item: PendingStageUp }
  | { phase: "done"; item: PendingStageUp; affirmed: boolean };

interface StageUpOfferProps {
  pendingStageUps: PendingStageUp[];
  visitId?: string | null;
}

// Wording per pending stage — named once here, not duplicated at each
// call site. "confronted" doesn't get its own generative artifact (that's
// reserved for "integrated" — see the phase==="done" block below); it
// still gets its own real question, just a smaller one.
const ASK: Record<DepthStage, (value: string) => string> = {
  surface: () => "", // never actually offered — surface is the resting state, not a proposal
  confronted: (value) =>
    `You have returned to this before: "${value}" — not just noticed again, but turned to face.`,
  integrated: (value) =>
    `"${value}" has come back to you again and again, each time in your own words. Something has shifted in how you carry it.`,
};

const HELD_LINE: Record<DepthStage, string> = {
  surface: "",
  confronted: "faced, not just seen",
  // The vessel speaking, not any lineage's authored voice — same register
  // GuidedJournalPrompt.tsx's own completion line already established.
  // Deliberately NOT spliced into any lineage's Threshold Letter content
  // (per-voice authored material — see lib/mythopoetics/thresholdLetter.ts's
  // own header on why this codebase never invents un-authored lineage copy).
  integrated: "What you named as this you now carry as yourself — the fire no longer needs to point at it.",
};

/**
 * The seeker's own explicit affirmation of a proposed depth-stage
 * transition (migrations 020/021, POST /api/elder/confirm-depth-stage).
 * Mirrors MarkerOffer.tsx's own shape deliberately — same fade-in pacing,
 * same restrained visual language, same "the seeker is the authority on
 * their own becoming" posture: The Elder only ever notices a threshold
 * was crossed (pure reshape-count arithmetic, zero model judgment); this
 * component is where the seeker decides whether that's true.
 *
 * Explicitly NOT a progress bar, counter, or "level up" moment — no
 * numbers appear anywhere in this component. If a proposal is declined,
 * nothing is lost (reshape_count is untouched); a later reshape simply
 * re-proposes the same target on the seeker's own future pace.
 */
export default function StageUpOffer({ pendingStageUps, visitId }: StageUpOfferProps) {
  const [queue, setQueue] = useState<PendingStageUp[]>(pendingStageUps);
  const [state, setState] = useState<OfferState | null>(
    pendingStageUps.length > 0 ? { phase: "offered", item: pendingStageUps[0] } : null
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!state) return;
    setVisible(false);
    const timer = setTimeout(() => setVisible(true), 2600);
    return () => clearTimeout(timer);
  }, [state?.phase === "offered" ? state.item.trajectoryId : null]);

  async function respond(item: PendingStageUp, affirm: boolean) {
    try {
      const res = await fetch("/api/elder/confirm-depth-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trajectoryId: item.trajectoryId, affirm, visitId: visitId ?? undefined }),
      });
      await res.json().catch(() => null);
      setState({ phase: "done", item, affirmed: affirm });
    } catch {
      setState({ phase: "done", item, affirmed: false });
    }
  }

  function advance() {
    const rest = queue.slice(1);
    setQueue(rest);
    setState(rest.length > 0 ? { phase: "offered", item: rest[0] } : null);
  }

  if (!state) return null;

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

      {state.phase === "offered" && (
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
            {ASK[state.item.pendingStage](state.item.markerValue)}
          </p>
          <div style={{ display: "flex", gap: "1.75rem", marginTop: "0.25rem" }}>
            <StageButton label="I have faced this" onClick={() => respond(state.item, true)} />
            <StageButton label="not yet" onClick={() => respond(state.item, false)} muted />
          </div>
        </>
      )}

      {state.phase === "done" && (
        <>
          <p
            style={{
              fontStyle: "italic",
              color: state.affirmed ? "rgba(230, 200, 150, 0.82)" : "rgba(180,160,140,0.55)",
              fontSize: state.item.pendingStage === "integrated" && state.affirmed ? "0.92rem" : "0.75rem",
              letterSpacing: state.item.pendingStage === "integrated" && state.affirmed ? "normal" : "0.1em",
              textTransform: state.item.pendingStage === "integrated" && state.affirmed ? "none" : "uppercase",
              lineHeight: 1.75,
              margin: 0,
            }}
          >
            {state.affirmed ? HELD_LINE[state.item.pendingStage] : "left for now"}
          </p>
          {queue.length > 1 && (
            <StageButton label="continue" onClick={advance} />
          )}
        </>
      )}
    </div>
  );
}

function StageButton({ label, onClick, muted }: { label: string; onClick: () => void; muted?: boolean }) {
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
