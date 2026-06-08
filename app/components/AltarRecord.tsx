"use client";

import { useState, useEffect } from "react";
import type { AltarEntry, SignalValue } from "@/lib/altar-types";
import {
  color,
  type as t,
  space,
  border,
  motion,
  glyph,
  surface,
  divider,
} from "@/lib/elder-tokens";

const ALTAR_KEY = "elder_altar_record";

const LINEAGE_LABELS: Record<string, string> = {
  ojer_tzij:  "Ojer Tzij",
  norse:      "Norse",
  egyptian:   "Egyptian",
  greek:      "Greek / Pythia",
  yoruba:     "Yoruba",
  aboriginal: "Aboriginal",
  taoist:     "Taoist",
  sufi:       "Sufi",
  "default":  "Elder",
};

export default function AltarRecord() {
  const [records,  setRecords]  = useState<AltarEntry[]>([]);
  const [filter,   setFilter]   = useState<"all" | SignalValue>("all");
  const [visible,  setVisible]  = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ALTAR_KEY);
      if (raw) setRecords(JSON.parse(raw));
    } catch {
      setRecords([]);
    }
    const timer = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(timer);
  }, []);

  const filtered = filter === "all"
    ? records
    : records.filter((r) => r.signal === filter);

  const landed   = records.filter((r) => r.signal === "landed").length;
  const missed   = records.filter((r) => r.signal === "did_not_land").length;
  const total    = records.length;
  const landRate = total > 0 ? Math.round((landed / total) * 100) : null;

  const byLineage: Record<string, { landed: number; missed: number }> = {};
  for (const r of records) {
    if (!byLineage[r.lineage]) byLineage[r.lineage] = { landed: 0, missed: 0 };
    if (r.signal === "landed") byLineage[r.lineage].landed++;
    else byLineage[r.lineage].missed++;
  }

  return (
    <div style={{
      ...surface.page,
      opacity:    visible ? 1 : 0,
      transition: motion.opacity,
    }}>

      <header style={{ marginBottom: space.sectionGap }}>
        <h1 style={{
          fontSize:      t.size.body,
          letterSpacing: t.tracking.max,
          textTransform: t.transform.upper,
          fontWeight:    t.weight.normal,
          color:         color.amber.tertiary,
          margin:        0,
          marginBottom:  "0.4rem",
        }}>
          Altar Record
        </h1>
        <p style={{
          fontSize:      t.size.caption,
          letterSpacing: t.tracking.normal,
          color:         color.amber.muted,
          margin:        0,
        }}>
          Post-reading signal archive
        </p>
      </header>

      <div style={{ ...divider.horizontal, marginBottom: space.sectionGap, opacity: 0.5 }} />

      <div style={{ display: "flex", gap: space["3"], marginBottom: space.sectionGap, flexWrap: "wrap" }}>
        <Stat label="total"  value={total}  />
        <Stat label="landed" value={landed} />
        <Stat label="passed" value={missed} />
        {landRate !== null && (
          <Stat
            label="land rate"
            value={landRate + "%"}
            valueColor={landRate >= 70 ? color.semantic.confirm : color.amber.primary}
          />
        )}
      </div>

      {Object.keys(byLineage).length > 0 && (
        <section style={{ marginBottom: space.sectionGap }}>
          <SectionHeader>by lineage</SectionHeader>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: t.size.body, fontFamily: t.family }}>
            <thead>
              <tr>
                {["Lineage", "Landed", "Passed", "Rate"].map((h) => (
                  <th key={h} style={{
                    textAlign:     "left",
                    padding:       space.cellPadding,
                    color:         color.amber.muted,
                    letterSpacing: t.tracking.tight,
                    fontWeight:    t.weight.normal,
                    borderBottom:  border.section,
                    textTransform: t.transform.upper,
                    fontSize:      t.size.micro,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byLineage).map(([lineage, counts]) => {
                const rowTotal = counts.landed + counts.missed;
                const rate = rowTotal > 0 ? Math.round((counts.landed / rowTotal) * 100) : 0;
                return (
                  <tr key={lineage}>
                    <Td>{LINEAGE_LABELS[lineage] ?? lineage}</Td>
                    <Td>{counts.landed}</Td>
                    <Td>{counts.missed}</Td>
                    <Td style={{ color: rate >= 70 ? color.semantic.confirm : color.amber.secondary }}>
                      {rate}%
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <SectionHeader>signal log</SectionHeader>
        <div style={{ display: "flex", gap: space["1"], marginBottom: space["1"] }}>
          {(["all", "landed", "did_not_land"] as const).map((f) => (
            <FilterTab key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? "all" : f === "landed" ? "landed" : "passed"}
            </FilterTab>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p style={{ fontSize: t.size.ui, color: color.amber.ghost, fontStyle: "italic", margin: space["1"] + " 0" }}>
            No signals recorded yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[...filtered].reverse().map((r, i) => (
              <LogRow key={i} entry={r} />
            ))}
          </div>
        )}
      </section>

      {records.length > 0 && (
        <div style={{ marginTop: space["3"] }}>
          <div style={{ ...divider.horizontal, marginBottom: space["3"], opacity: 0.3 }} />
          <DangerButton onClick={() => {
            if (confirm("Clear the entire altar record? This cannot be undone.")) {
              localStorage.removeItem(ALTAR_KEY);
              setRecords([]);
            }
          }}>
            clear altar record
          </DangerButton>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, valueColor }: {
  label: string; value: string | number; valueColor?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <span style={{ fontSize: t.size.hero, color: valueColor ?? color.amber.primary, fontFamily: t.family, lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: t.size.micro, letterSpacing: t.tracking.wide, textTransform: t.transform.upper, color: color.amber.muted }}>
        {label}
      </span>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize:      t.size.micro,
      letterSpacing: t.tracking.max,
      textTransform: t.transform.upper,
      color:         color.amber.muted,
      margin:        0,
      marginBottom:  space["1"],
    }}>
      {children}
    </p>
  );
}

function Td({ children, style: override }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{
      padding:      space.cellPadding,
      color:        color.amber.secondary,
      borderBottom: border.row,
      fontSize:     t.size.body,
      ...override,
    }}>
      {children}
    </td>
  );
}

function FilterTab({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background:    "none",
        border:        "none",
        borderBottom:  active ? "1px solid " + color.amber.tertiary : border.none,
        cursor:        "pointer",
        fontSize:      t.size.tag,
        letterSpacing: t.tracking.wide,
        textTransform: t.transform.upper,
        color:         active ? color.amber.primary : color.amber.muted,
        padding:       "0.2rem 0",
        fontFamily:    t.family,
        transition:    motion.colorFast,
      }}
    >
      {children}
    </button>
  );
}

function LogRow({ entry }: { entry: AltarEntry }) {
  const isLanded = entry.signal === "landed";
  return (
    <div style={{
      display:        "flex",
      justifyContent: "space-between",
      alignItems:     "center",
      padding:        space.rowPadding + " 0",
      borderBottom:   border.row,
      gap:            space["1"],
    }}>
      <span style={{ fontSize: t.size.tag, color: color.amber.muted, minWidth: "6rem", flexShrink: 0 }}>
        {new Date(entry.timestamp).toLocaleDateString("en-US", {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        })}
      </span>
      <span style={{ fontSize: t.size.ui, color: color.amber.secondary, flexGrow: 1 }}>
        {LINEAGE_LABELS[entry.lineage] ?? entry.lineage}
      </span>
      <span style={{ fontSize: t.size.ui, color: color.amber.secondary }}>
        {entry.trecena + " " + entry.nahual}
      </span>
      <span
        style={{
          fontSize:   glyph.size.small,
          color:      isLanded ? color.glyph.landedFaded : color.glyph.passedFaded,
          flexShrink: 0,
          width:      "1.5rem",
          textAlign:  "right",
        }}
        dangerouslySetInnerHTML={{ __html: isLanded ? "&#8853;" : "&#9711;" }}
      />
    </div>
  );
}

function DangerButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:    "none",
        border:        hovered ? border.controlDanger : border.control,
        color:         hovered ? color.semantic.danger : color.amber.ghost,
        fontSize:      t.size.micro,
        letterSpacing: t.tracking.wide,
        textTransform: t.transform.upper,
        padding:       "0.5rem 1rem",
        cursor:        "pointer",
        fontFamily:    t.family,
        transition:    motion.colorFast + ", border-color " + motion.fast,
      }}
    >
      {children}
    </button>
  );
}
