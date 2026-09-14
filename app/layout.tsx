import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import CeremonyGround from "@/app/components/CeremonyGround";
import FireAtmosphere from "@/app/components/FireAtmosphere";
import PresenceAtmosphere from "@/app/components/PresenceAtmosphere";
import { ElderLogoMark } from "@/app/components/ElderLogo";

export const metadata: Metadata = {
  title: "THE ELDER · Myth Diviner",
  description: "The Elder reveals the myth living through your life. A consciousness transformation project of the Temporal Bridges Institute and AHAU AI.",
  authors: [{ name: "Temporal Bridges Institute" }],
  robots: "index, follow",
  openGraph: {
    title: "THE ELDER · Myth Diviner",
    description: "You did not choose your myth. Your myth chose you.",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "THE ELDER — Myth Diviner." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "THE ELDER · Myth Diviner",
    description: "You did not choose your myth. Your myth chose you.",
    images: ["/og-image.png"],
  },
  themeColor: "#0a0806",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mul">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Was a CSS @import inside globals.css -- see the note there.
            Same URL, moved here so it's discovered on HTML parse instead
            of nested inside another CSS file's download+parse step. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600&family=Gentium+Plus:ital,wght@0,400;0,700;1,400;1,700&display=swap"
        />
        <link rel="preload" as="image" href="/og-image.png" />
      </head>
      <body>
        <LanguageProvider>
          {/* The persistent ground for the whole opening sequence -- mounted
              once here so the breath, front-door ask, age beat and
              lineage-select are one continuous room. See CeremonyGround. */}
          <CeremonyGround />
          {/* arrivalNudge lives on this one persistent instance only -- it is
              the fire behind the entry gate (BreathGate renders none of its
              own). The per-beat FireAtmosphere instances inside Threshold
              stay unset: the "someone just arrived" lean belongs to arrival,
              not to every later beat. */}
          <FireAtmosphere arrivalNudge />
          <PresenceAtmosphere />
          {/* Persistent brand mark, every route -- small and low-opacity so
              it reads as a watermark, not a UI element competing for
              attention. Fixed above the ambient fire (zIndex 0-1) but
              below every full-bleed ceremony beat (BreathGate zIndex 100,
              LineageSelector 200, ShareableCard 1000) -- those already
              have their own eye/logo moments, so this is naturally
              covered by their own opaque/near-opaque backgrounds rather
              than needing its own show/hide logic. */}
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              top: 18,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 50,
              opacity: 0.4,
              pointerEvents: "none",
            }}
          >
            <ElderLogoMark width={30} />
          </div>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
