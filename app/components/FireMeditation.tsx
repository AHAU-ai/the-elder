'use client';

// app/components/FireMeditation.tsx
//
// The Fire Meditation: sit at the fire, alone, for as long as you like, with
// the whole instrument and no words. The room adds nothing of its own to the
// layout's ground; it only lets the instrument be heard and seen:
//   - the layout's ground, embers, the hour's light and the ceremonial drone
//     (the drone sounds here; it is silent only for the Fireside Chat, where
//     someone is speaking with the Elder)
//   - the fire with its own sound (crackle, bed, heartbeat) and the usual
//     mute control, honouring the on-device sound choice
//   - the fire leaning gently with the shared breath cadence, never prompting
//     it. Static under reduced motion.
// No text, timer, counter, prompt or end. The only way out is a quiet glyph
// (and Escape), named for assistive tech with the existing "The Fire" label.
// The language control steps aside here (LanguageToggle) because it is all
// words. The screen is kept awake, where the device allows, so a long sitting
// is not dimmed away. Everything here is best-effort and fails silent.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FireAtmosphere from './FireAtmosphere';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import { BREATH_PHASES } from '../../lib/breathTiming';
import { meditationFireIntensity, MEDITATION_FIRE_LOW } from '../../lib/fireMeditation';
import { readSoundPref } from '../../lib/portalLure';
import { keepScreenAwake } from '../../lib/screenWakeLock';

export default function FireMeditation() {
  const { t } = useLanguage();
  const router = useRouter();
  // Server and first client render agree on "no sound"; the on-device choice is read after mount.
  const [soundOn, setSoundOn] = useState(false);
  const [intensity, setIntensity] = useState(MEDITATION_FIRE_LOW);

  useEffect(() => { setSoundOn(readSoundPref()); }, []);

  // The fire follows the breath cadence, phase by phase (the fire eases between levels).
  useEffect(() => {
    let reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
    if (reduced) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const phase = BREATH_PHASES[i % BREATH_PHASES.length];
      setIntensity(meditationFireIntensity(phase.name));
      i++;
      timer = setTimeout(step, phase.duration);
    };
    step();
    return () => clearTimeout(timer);
  }, []);

  // Keep the screen awake for a long sitting, where the device supports it.
  // (Re-acquired whenever the browser releases it; see lib/screenWakeLock.)
  useEffect(() => keepScreenAwake({ navigator: navigator as any, document }), []);

  // Escape returns to the fire's front room.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push('/'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <>
      {/* The page's own fire, as each Threshold beat has: the sound and mute control live here. */}
      <FireAtmosphere soundEnabled={soundOn} intensity={intensity} />
      <main
        aria-label={t('nav.fire')}
        style={{
          position: 'relative',
          zIndex: 10,
          minHeight: 'var(--vh-full)',
          background: 'transparent',
          pointerEvents: 'none',
        }}
      >
        <Link
          href="/"
          aria-label={t('nav.fire')}
          title={t('nav.fire')}
          style={{
            position: 'fixed',
            bottom: 22,
            left: 22,
            zIndex: 9998,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: 'rgba(10,8,6,0.72)',
            border: '1px solid rgba(212,168,67,0.22)',
            color: '#d4a843',
            fontSize: '0.9rem',
            textDecoration: 'none',
            opacity: 0.5,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'auto',
          }}
        >
          <span aria-hidden="true">◦</span>
        </Link>
      </main>
    </>
  );
}
