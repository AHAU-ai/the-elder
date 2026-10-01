"use client";

import { useEffect, useRef, useState } from "react";
import { CARRY_COPY, CARRY_PRACTICES, MAX_LINE_CHARS, type CarryPracticeKey } from "../../lib/returning/carry";

/**
 * R2/R3 (ADR-0015). After a reading, a signed-in seeker may carry out one way
 * of looking (a fixed menu, looking only) and/or one line in their own words.
 * Fully optional and collapsed by default; "Not now" costs nothing. Appears
 * only when the server says the feature is lit (GET /api/user/carry). Nothing
 * is asked of the seeker afterwards: no follow-up, no reminder, no tracking.
 * Mirrors MarkerOffer's slot and pacing, arriving a beat after it.
 */
type Phase = "hidden" | "closed" | "open" | "done" | "gone";

const FONT = "'IM Fell English', 'Palatino Linotype', Georgia, serif";
const TEXT = "rgba(230, 200, 150, 0.86)";
const MUTED = "rgba(210, 185, 140, 0.78)";

export default function CarryOffer({ visitId }: { visitId: string }) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [visible, setVisible] = useState(false);
  const [practice, setPractice] = useState<CarryPracticeKey | null>(null);
  const [line, setLine] = useState("");
  const [busy, setBusy] = useState(false);
  const firstRadio = useRef<HTMLInputElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/carry")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.enabled === true) setPhase("closed"); })
      .catch(() => {});
    const t = setTimeout(() => setVisible(true), 5200);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  useEffect(() => {
    if (phase === "open") firstRadio.current?.focus();
  }, [phase]);

  async function submit() {
    if (busy || (!practice && !line.trim())) return;
    setBusy(true);
    try {
      const res = await fetch("/api/user/carry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId, practice, line: line.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      // A welfare reading, a rate limit or any failure fails toward silence,
      // the same posture as MarkerOffer: nothing is claimed as carried.
      setPhase(res.ok && data?.carried ? "done" : "gone");
    } catch {
      setPhase("gone");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "hidden" || phase === "gone") return null;

  const btn: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontStyle: "italic",
    fontSize: "0.82rem", letterSpacing: "0.03em", color: MUTED, minHeight: 44, padding: "10px 14px",
  };

  return (
    <div
      style={{
        maxWidth: 460, margin: "1.25rem auto 0", textAlign: "center", fontFamily: FONT,
        opacity: visible ? 1 : 0, transition: "opacity 1.4s ease", pointerEvents: visible ? "auto" : "none",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem",
      }}
    >
      {phase === "closed" && (
        <button ref={openerRef} type="button" style={btn} onClick={() => setPhase("open")}>
          {CARRY_COPY.offerOpen}
        </button>
      )}

      {phase === "open" && (
        <>
          <fieldset style={{ border: "none", margin: 0, padding: 0, width: "100%" }}>
            <legend style={{ fontStyle: "italic", color: TEXT, fontSize: "0.95rem", lineHeight: 1.75, padding: 0, margin: "0 auto 0.5rem" }}>
              {CARRY_COPY.offerLead}
            </legend>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 2 }}>
              {CARRY_PRACTICES.map((p, i) => (
                <label
                  key={p.key}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "6px 12px", cursor: "pointer",
                    color: practice === p.key ? "rgba(245, 215, 160, 1)" : TEXT, fontStyle: "italic", fontSize: "0.9rem", textAlign: "left",
                    border: `1px solid ${practice === p.key ? "rgba(212,168,67,0.55)" : "rgba(212,168,67,0.18)"}`,
                  }}
                >
                  <input
                    ref={i === 0 ? firstRadio : undefined}
                    type="radio"
                    name="carry-practice"
                    checked={practice === p.key}
                    onChange={() => setPractice(p.key)}
                    // Re-tapping the chosen way clears it: the practice is optional.
                    onClick={() => { if (practice === p.key) setPractice(null); }}
                    style={{ accentColor: "#d4a843", width: 18, height: 18 }}
                  />
                  <span>{p.text}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label style={{ width: "100%", display: "block" }}>
            <span style={{ display: "block", color: MUTED, fontSize: "0.78rem", fontStyle: "italic", lineHeight: 1.6, marginBottom: 6 }}>
              {CARRY_COPY.linePrompt}
            </span>
            <textarea
              value={line}
              onChange={(e) => setLine(e.target.value.slice(0, MAX_LINE_CHARS))}
              maxLength={MAX_LINE_CHARS}
              rows={2}
              style={{
                width: "100%", boxSizing: "border-box", background: "rgba(8,6,4,0.6)", border: "1px solid rgba(212,168,67,0.28)",
                color: "rgba(230, 200, 150, 0.92)", fontFamily: "inherit", fontSize: "0.9rem", fontStyle: "italic", padding: "10px 14px", resize: "vertical",
              }}
            />
          </label>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" style={{ ...btn, color: "rgba(240,195,90,1)", opacity: busy || (!practice && !line.trim()) ? 0.6 : 1 }} disabled={busy || (!practice && !line.trim())} onClick={submit}>
              {CARRY_COPY.carry}
            </button>
            <button type="button" style={btn} onClick={() => { setPhase("closed"); setTimeout(() => openerRef.current?.focus(), 0); }}>
              {CARRY_COPY.notNow}
            </button>
          </div>
        </>
      )}

      {phase === "done" && (
        <p role="status" style={{ fontSize: "0.68rem", letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED, margin: 0 }}>
          {CARRY_COPY.held}
        </p>
      )}
    </div>
  );
}
