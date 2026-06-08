// elder-tokens.ts
// Design system tokens for The Elder.
// Single source of truth. Never write raw values inline.
//
// Usage:
//   import { color, type as t, space, motion, border, glyph, surface, divider } from "@/lib/elder-tokens";

export const color = {
  canvas:    "#0e0b08",
  canvasAlt: "#121009",
  amber: {
    primary:   "rgba(210, 175, 100, 0.85)",
    secondary: "rgba(210, 175, 100, 0.65)",
    tertiary:  "rgba(210, 175, 100, 0.50)",
    muted:     "rgba(210, 175, 100, 0.35)",
    ghost:     "rgba(210, 175, 100, 0.25)",
    whisper:   "rgba(210, 175, 100, 0.10)",
    trace:     "rgba(210, 175, 100, 0.07)",
  },
  glyph: {
    landed:      "rgba(220, 170,  70, 0.85)",
    landedHover: "rgba(240, 195,  90, 1.00)",
    passed:      "rgba(180, 160, 140, 0.45)",
    passedHover: "rgba(200, 180, 160, 0.70)",
    landedFaded: "rgba(220, 170,  70, 0.80)",
    passedFaded: "rgba(180, 160, 140, 0.50)",
  },
  semantic: {
    confirm:      "rgba(180, 220, 120, 0.70)",
    danger:       "rgba(210, 100,  80, 0.60)",
    dangerBorder: "rgba(210, 100,  80, 0.30)",
  },
  divider:  "linear-gradient(to bottom, transparent, rgba(200,160,80,0.4), transparent)",
  dividerH: "linear-gradient(to right,  transparent, rgba(200,160,80,0.4), transparent)",
} as const;

export const type = {
  family: "'IM Fell English', 'Palatino Linotype', Georgia, serif",
  size: {
    hero:    "1.4rem",
    body:    "0.78rem",
    ui:      "0.75rem",
    label:   "0.72rem",
    caption: "0.70rem",
    tag:     "0.65rem",
    micro:   "0.60rem",
  },
  tracking: {
    tight:  "0.12em",
    normal: "0.15em",
    wide:   "0.20em",
    xwide:  "0.22em",
    max:    "0.30em",
  },
  weight:    { normal: "normal" as const },
  transform: { upper:  "uppercase" as const },
} as const;

export const space = {
  "0.5": "0.5rem",
  "1":   "1rem",
  "1.25":"1.25rem",
  "1.5": "1.5rem",
  "2":   "2rem",
  "2.5": "2.5rem",
  "3":   "3rem",
  "3.5": "3.5rem",
  sectionGap:   "2.5rem",
  componentGap: "1.25rem",
  rowPadding:   "0.6rem",
  cellPadding:  "0.5rem 0.8rem",
  pageInset:    "3rem 2rem",
  maxWidth:     "760px",
} as const;

export const border = {
  row:          "1px solid rgba(210, 175, 100, 0.07)",
  section:      "1px solid rgba(210, 175, 100, 0.10)",
  control:      "1px solid rgba(210, 175, 100, 0.15)",
  controlDanger:"1px solid rgba(210, 100,  80, 0.30)",
  none:         "1px solid transparent",
} as const;

export const motion = {
  fast:      "0.2s",
  medium:    "0.3s",
  slow:      "1.4s",
  breath:    1800,
  ease:      "ease",
  easeOut:   "ease-out",
  color:     "color 0.3s ease",
  colorFast: "color 0.2s ease",
  transform: "transform 0.2s ease",
  opacity:   "opacity 1.4s ease",
  keyframes: { rippleFade: "rippleFade" },
  rippleFadeCSS: `
    @keyframes rippleFade {
      0%   { opacity: 0.3; transform: scale(0.92); }
      40%  { opacity: 1;   transform: scale(1.04); }
      100% { opacity: 1;   transform: scale(1); }
    }
  `,
} as const;

export const glyph = {
  landed:     "⊕",
  passed:     "◯",
  hoverScale: "scale(1.08)",
  size: {
    large:  "2rem",
    medium: "1.6rem",
    small:  "1rem",
  },
  landedGlow: (hoverColor: string) =>
    `0 0 18px ${hoverColor}, 0 0 40px rgba(220,170,70,0.3)`,
} as const;

export const divider = {
  vertical: {
    width:      "1px",
    height:     "2rem",
    background: "linear-gradient(to bottom, transparent, rgba(200,160,80,0.4), transparent)",
  },
  horizontal: {
    height:     "1px",
    width:      "100%",
    background: "linear-gradient(to right, transparent, rgba(200,160,80,0.4), transparent)",
  },
} as const;

export const surface = {
  page: {
    minHeight:  "100vh",
    background: "#0e0b08",
    color:      "rgba(210, 175, 100, 0.85)",
    fontFamily: "'IM Fell English', 'Palatino Linotype', Georgia, serif",
    padding:    "3rem 2rem",
    maxWidth:   "760px",
    margin:     "0 auto",
  },
} as const;
