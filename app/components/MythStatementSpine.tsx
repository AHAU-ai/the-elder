'use client';

// app/components/MythStatementSpine.tsx
//
// Journal spine (myth-as-home, Part A §3): the current Core Myth
// Statement at top, older superseded versions collapsed underneath in
// time order. Each version's source markers are listed raw and
// unconnected -- same structural non-connection discipline as
// assembleIntegratedMaterial (lib/returning/coreMythStatement.ts): a
// rows.map(), never a joined sentence. The spine holds the statement
// itself, not an assertion about how the markers across versions relate.
//
// Self-contained (fetches its own data), silent when there's nothing to
// show -- a seeker with no Core Myth Statement yet sees nothing from
// this component at all; CoreMythStatement.tsx (rendered elsewhere in
// MythicJournal.tsx) is what offers the invitation to write one.

import { useEffect, useState } from 'react';

interface SourceMarker {
  trajectoryId: number;
  markerType: string;
  markerValue: string;
}

interface StatementVersion {
  id: number;
  version: number;
  bodyText: string;
  createdAt: string;
  supersededAt: string | null;
  sourceMarkers: SourceMarker[];
}

const C = {
  gold:  '#d4a843',
  ash:   '#c4b89a',
  smoke: '#a8916f',
  bone:  '#fdf6e8',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function MythStatementSpine() {
  const [history, setHistory] = useState<StatementVersion[] | null>(null);

  useEffect(() => {
    fetch('/api/elder/core-myth-statement')
      .then(r => r.json())
      .then(d => setHistory(Array.isArray(d?.history) ? d.history : []))
      .catch(() => setHistory([]));
  }, []);

  if (!history || history.length === 0) return null;

  const [current, ...older] = history;

  return (
    <div style={{ marginBottom: 44 }}>
      <div style={{ fontSize: '0.56rem', letterSpacing: '0.28em', color: C.gold, textTransform: 'uppercase', opacity: 0.85, marginBottom: 16 }}>
        Your Core Myth Statement
      </div>

      <div style={{
        background: 'rgba(212,168,67,0.05)', border: `1px solid ${C.gold}44`,
        padding: '26px 28px', marginBottom: older.length > 0 ? 14 : 0,
      }}>
        <div style={{ fontSize: '0.62rem', color: C.smoke, letterSpacing: '0.08em', marginBottom: 12 }}>
          {formatDate(current.createdAt)}
        </div>
        <div style={{ fontStyle: 'italic', fontSize: '1rem', lineHeight: 1.9, color: C.bone, whiteSpace: 'pre-wrap' }}>
          {current.bodyText}
        </div>
      </div>

      {older.length > 0 && (
        <details style={{ marginTop: 4 }}>
          <summary style={{
            cursor: 'pointer', color: C.smoke, fontSize: '0.66rem', letterSpacing: '0.1em',
            textTransform: 'uppercase', opacity: 0.65, padding: '6px 0',
          }}>
            {older.length} earlier {older.length === 1 ? 'version' : 'versions'}
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            {older.map(v => (
              <div key={v.id} style={{
                background: 'rgba(255,255,255,0.015)', border: `1px solid ${C.smoke}33`,
                padding: '18px 22px',
              }}>
                <div style={{ fontSize: '0.6rem', color: C.smoke, letterSpacing: '0.08em', marginBottom: 10 }}>
                  {formatDate(v.createdAt)}
                </div>
                <div style={{ fontStyle: 'italic', fontSize: '0.9rem', lineHeight: 1.8, color: C.ash, whiteSpace: 'pre-wrap', marginBottom: v.sourceMarkers.length > 0 ? 12 : 0 }}>
                  {v.bodyText}
                </div>
                {v.sourceMarkers.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {v.sourceMarkers.map(m => (
                      <div key={m.trajectoryId} style={{ fontStyle: 'italic', color: C.smoke, fontSize: '0.72rem', opacity: 0.8 }}>
                        &ldquo;{m.markerValue}&rdquo;
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
