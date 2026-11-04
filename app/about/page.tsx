// app/about/page.tsx
// Route: /about — canonical, third-person Purpose Statement.

import PurposeStatement from '@/app/components/PurposeStatement';
import T from '@/app/components/T';
import { PURPOSE_VERSION, PURPOSE_ADOPTED } from '@/lib/purposeStatement';

export default function AboutPage() {
  return (
    <main
      style={{
        // Positioned above the root layout's fixed ground/fire layers
        // (z-index 0-2); without this the statement paints underneath
        // them and is invisible.
        position: 'relative',
        zIndex: 10,
        minHeight: 'var(--vh-full)',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
      }}
    >
      <div style={{ maxWidth: 640 }}>
        <PurposeStatement register="canonical" />
        {/* PURPOSE_VERSION/PURPOSE_ADOPTED were defined but shown nowhere --
            this app already has a provenance culture (corpus/model/contract
            version stamped on every reading); the Purpose Statement itself
            deserves the same, not a silent exception. */}
        <div style={{
          textAlign: 'center',
          marginTop: 28,
          fontSize: '0.56rem',
          letterSpacing: '0.12em',
          color: '#5a4a3a',
          opacity: 0.7,
        }}>
          <T k="about.version" vars={{ version: PURPOSE_VERSION, adopted: PURPOSE_ADOPTED }} />
        </div>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a
            href="/tradition-bearers"
            style={{
              fontSize: '0.62rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#d4a843',
              textDecoration: 'none',
              borderBottom: '1px solid rgba(212,168,67,0.35)',
              paddingBottom: 2,
            }}
          >
            If you speak for a tradition, start here
          </a>
        </div>
      </div>
    </main>
  );
}
