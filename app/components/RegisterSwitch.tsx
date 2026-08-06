'use client';

// Near-fire control for the age-tiered narrative register.
// Spec: docs/age-register-spec.md §6, §13.
// Verified against real source before writing this file: the project
// has no Tailwind config (app/globals.css + app/globals-v3-additions.css
// are plain CSS), so the original draft's utility classes were replaced
// with BEM-style classes styled in globals-v3-additions.css. There is
// also no existing sound-toggle UI control in Threshold.tsx to mirror —
// soundEnabled (Threshold.tsx) is state-only, defaulted true, with no
// visible switch — so this component establishes the pattern rather
// than copying one.

export type NarrativeRegister = 'child' | 'young_adult' | 'adult';

interface RegisterSwitchProps {
  register: NarrativeRegister;
  onChange: (r: NarrativeRegister) => void;
  // Gated behind NARRATIVE_REGISTER_CHILD_ENABLED (spec §9/§11) until legal
  // (COPPA) + clinical (crisis copy) sign-off happens. Defaults to false —
  // the safer default when a caller forgets to pass it explicitly, since
  // omitting it should never accidentally surface the ungated tier.
  childTierEnabled?: boolean;
}

const REGISTER_LABELS: Record<NarrativeRegister, string> = {
  child: 'a few turnings',
  young_adult: 'a handful more',
  adult: 'many turnings',
};

export function RegisterSwitch({ register, onChange, childTierEnabled = false }: RegisterSwitchProps) {
  const order: NarrativeRegister[] = childTierEnabled
    ? ['child', 'young_adult', 'adult']
    : ['young_adult', 'adult'];
  return (
    <div
      className="register-switch"
      aria-label="How many turnings of the sun have shaped you"
    >
      {order.map((tier) => (
        <button
          key={tier}
          type="button"
          onClick={() => onChange(tier)}
          aria-pressed={register === tier}
          className={`register-switch__tier${register === tier ? ' register-switch__tier--active' : ''}`}
        >
          {REGISTER_LABELS[tier]}
        </button>
      ))}
    </div>
  );
}
