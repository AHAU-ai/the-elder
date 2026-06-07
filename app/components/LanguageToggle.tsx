// app/components/LanguageToggle.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LOCALES, Locale } from "@/lib/i18n/translations";

export default function LanguageToggle() {
  const { locale, setLocale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === locale)!;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(code: Locale) {
    setLocale(code);
    setOpen(false);
  }

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        display: "inline-block",
        fontFamily: "inherit",
      }}
    >
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.select_language}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "2rem",
          padding: "0.4rem 0.9rem",
          color: "rgba(255,255,255,0.72)",
          fontSize: "0.78rem",
          letterSpacing: "0.08em",
          cursor: "pointer",
          transition: "border-color 0.2s, color 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "rgba(255,180,80,0.55)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "rgba(255,200,120,0.95)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "rgba(255,255,255,0.18)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "rgba(255,255,255,0.72)";
        }}
      >
        <GlobeIcon />
        <span>{current.nativeLabel}</span>
        <ChevronIcon open={open} />
      </button>

      {/* Dropdown */}
      {open && (
        <ul
          role="listbox"
          aria-label={t.select_language}
          style={{
            position: "absolute",
            top: "calc(100% + 0.5rem)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(18, 12, 6, 0.97)",
            border: "1px solid rgba(255,180,80,0.25)",
            borderRadius: "0.75rem",
            padding: "0.4rem 0",
            minWidth: "10rem",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            zIndex: 100,
            listStyle: "none",
            margin: 0,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {LOCALES.map((lang) => (
            <li
              key={lang.code}
              role="option"
              aria-selected={lang.code === locale}
              onClick={() => select(lang.code)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.45rem 1rem",
                cursor: "pointer",
                fontSize: "0.82rem",
                color:
                  lang.code === locale
                    ? "rgba(255,200,120,1)"
                    : "rgba(255,255,255,0.65)",
                background:
                  lang.code === locale
                    ? "rgba(255,180,80,0.08)"
                    : "transparent",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                if (lang.code !== locale) {
                  (e.currentTarget as HTMLLIElement).style.background =
                    "rgba(255,180,80,0.06)";
                  (e.currentTarget as HTMLLIElement).style.color =
                    "rgba(255,255,255,0.9)";
                }
              }}
              onMouseLeave={(e) => {
                if (lang.code !== locale) {
                  (e.currentTarget as HTMLLIElement).style.background =
                    "transparent";
                  (e.currentTarget as HTMLLIElement).style.color =
                    "rgba(255,255,255,0.65)";
                }
              }}
            >
              <span>{lang.nativeLabel}</span>
              {lang.code === locale && (
                <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>✦</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        flexShrink: 0,
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.2s",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
