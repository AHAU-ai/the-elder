// app/letters/stopped/page.tsx
// Route: /letters/stopped -- where the one-click stop in a letter email lands.
// Plain statement of fact. No farewell, no "sorry to see you go", no offer to
// reconsider: the instrument has no needs (ELDER-CEREMONY-SIGNAL-SURFACE §2.3).

export default function LettersStoppedPage() {
  return (
    <main
      style={{
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
      <p
        style={{
          maxWidth: 480,
          textAlign: 'center',
          fontStyle: 'italic',
          fontSize: '1.05rem',
          lineHeight: 1.9,
          color: '#ede0c4',
        }}
      >
        Letters will not be sent to you by email.
      </p>
    </main>
  );
}
