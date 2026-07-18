'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function BetaGateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/beta-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Something went wrong.');
        setLoading(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError('Could not reach the server.');
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0806',
        color: '#e8dfd0',
        fontFamily: 'serif',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          padding: '2rem',
          maxWidth: '360px',
          width: '100%',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', textAlign: 'center', letterSpacing: '0.05em' }}>
          THE ELDER
        </h1>
        <p style={{ fontSize: '0.9rem', opacity: 0.7, textAlign: 'center' }}>
          This instrument is in private beta. Enter the passphrase to continue.
        </p>
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Passphrase"
          autoFocus
          style={{
            padding: '0.75rem',
            background: '#1a1512',
            border: '1px solid #3a2f28',
            borderRadius: '4px',
            color: '#e8dfd0',
            fontSize: '1rem',
          }}
        />
        {error && (
          <p style={{ color: '#c47b6b', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem',
            background: '#3a2f28',
            border: 'none',
            borderRadius: '4px',
            color: '#e8dfd0',
            fontSize: '1rem',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Entering...' : 'Enter'}
        </button>
      </form>
    </div>
  );
}

export default function BetaGatePage() {
  return (
    <Suspense fallback={null}>
      <BetaGateForm />
    </Suspense>
  );
}
