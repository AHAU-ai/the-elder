// app/about/page.tsx
// Route: /about — canonical, third-person Purpose Statement.

import PurposeStatement from '@/app/components/PurposeStatement';

export default function AboutPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0a0806',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
      }}
    >
      <div style={{ maxWidth: 640 }}>
        <PurposeStatement register="canonical" />
      </div>
    </main>
  );
}
