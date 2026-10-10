'use client';

// PortalDoorChoice.tsx
//
// The way back to the door. A signed-in member can choose, at the door, to go
// straight in on every visit (saved on the account, so it follows them across
// devices). This is where they undo that. It renders nothing unless the choice
// is currently on: the door is the default and needs no setting.

import { useEffect, useState } from 'react';

const BYPASS_HINT = 'elder_portal_bypass_hint';

export default function PortalDoorChoice() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/user/portal')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live) setOn(!!d && d.member === true && d.bypass === true); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  async function showTheDoor() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/user/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bypass: false }),
      });
      if (res.ok) {
        setOn(false);
        try { localStorage.removeItem(BYPASS_HINT); } catch { /* ignore */ }
      }
    } catch { /* leave it as it was */ }
    setBusy(false);
  }

  if (!on) return null;
  return (
    <>
      <span>the door is skipped on arrival</span>
      <button className="threshold-sign-out" onClick={showTheDoor} disabled={busy}>
        Show the door
      </button>
    </>
  );
}
