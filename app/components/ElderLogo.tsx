/**
 * ElderLogo — THE ELDER wordmark/glyph, color version.
 * Clear zone is baked into the viewBox; do not crop or add elements inside it.
 * Do not stretch, recolor, or alter proportions.
 * Minimum reproduction size for this full lockup (with wordmark): 120px width.
 *
 * Font note: uses CSS variables --font-cinzel / --font-cinzel-decorative
 * with literal-name fallback, so it degrades gracefully to serif if you
 * haven't wired up next/font (see layout.tsx).
 */
export function ElderLogo({
  className = "",
  width = 120,
}: {
  className?: string;
  width?: number;
}) {
  const height = width * (960 / 760);
  return (
    <svg
      viewBox="-40 -40 760 960"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="The Elder"
    >
      <defs>
        <clipPath id="elder-logo-almond">
          <path d="M 102,308 C 210,194 466,196 578,312 C 466,416 210,420 102,308 Z" />
        </clipPath>
      </defs>
      <rect x="-40" y="-40" width="760" height="960" fill="#0c0a07" />
      <polygon points="340,72 578,308 340,544 102,308" fill="none" stroke="#c8a84a" strokeWidth={1.8} strokeLinejoin="round" />
      <polygon points="340,66 344,72 340,78 336,72" fill="#c8a84a" />
      <polygon points="572,308 578,312 584,308 578,304" fill="#c8a84a" />
      <polygon points="340,538 344,544 340,550 336,544" fill="#c8a84a" />
      <polygon points="96,308 102,312 108,308 102,304" fill="#c8a84a" />
      <path
        d="M 148,252 C 210,214 268,190 308,188 C 362,190 438,210 528,250"
        fill="none"
        stroke="#c8a84a"
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      <path
        d="M 102,308 C 210,194 466,196 578,312 C 466,416 210,420 102,308 Z"
        fill="#e8dfc8"
      />
      <circle cx="340" cy="304" r="88" fill="#3a1e06" clipPath="url(#elder-logo-almond)" />
      <circle cx="335" cy="300" r="40" fill="#000000" clipPath="url(#elder-logo-almond)" />
      <ellipse
        cx="322"
        cy="306"
        rx="3.5"
        ry="2.5"
        fill="#e8dfc8"
        opacity={0.55}
        transform="rotate(-15,322,306)"
        clipPath="url(#elder-logo-almond)"
      />
      <path d="M 102,308 C 210,194 466,196 578,312" fill="none" stroke="#c8a84a" strokeWidth={3.4} strokeLinecap="round" />
      <path d="M 102,308 C 210,420 466,416 578,312" fill="none" stroke="#c8a84a" strokeWidth={2.2} strokeLinecap="round" />
      <line x1="118" y1="592" x2="562" y2="592" stroke="#c8a84a" strokeWidth={0.6} />
      <text
        x="340"
        y="628"
        fontFamily="var(--font-cinzel, 'Cinzel'), serif"
        fontSize="24"
        fontWeight={400}
        fill="#c8a84a"
        opacity={0.72}
        textAnchor="middle"
        letterSpacing="12"
      >
        THE
      </text>
      <text
        x="340"
        y="696"
        fontFamily="var(--font-cinzel-decorative, 'Cinzel Decorative'), serif"
        fontSize="80"
        fontWeight={700}
        fill="#e8dfc8"
        textAnchor="middle"
        letterSpacing="10"
      >
        ELDER
      </text>
    </svg>
  );
}

/**
 * ElderLogoMark — icon-only variant of the same glyph: diamond frame +
 * almond eye, no wordmark text, no background fill (transparent, so it
 * can sit inside other ceremonial surfaces without painting a box over
 * them). This exists specifically because the full ElderLogo's wordmark
 * text becomes illegible below its own documented 120px minimum width,
 * and its background rect isn't appropriate for embedding inside another
 * composition. Same signed paths, just the portion of the viewBox above
 * the separator line/text block (y < ~560 of the original 960).
 */
export function ElderLogoMark({
  className = "",
  width = 88,
}: {
  className?: string;
  width?: number;
}) {
  const height = width * (620 / 760);
  return (
    <svg
      viewBox="-40 -40 760 620"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <clipPath id="elder-logo-mark-almond">
          <path d="M 102,308 C 210,194 466,196 578,312 C 466,416 210,420 102,308 Z" />
        </clipPath>
      </defs>
      <polygon points="340,72 578,308 340,544 102,308" fill="none" stroke="#c8a84a" strokeWidth={1.8} strokeLinejoin="round" />
      <polygon points="340,66 344,72 340,78 336,72" fill="#c8a84a" />
      <polygon points="572,308 578,312 584,308 578,304" fill="#c8a84a" />
      <polygon points="340,538 344,544 340,550 336,544" fill="#c8a84a" />
      <polygon points="96,308 102,312 108,308 102,304" fill="#c8a84a" />
      <path
        d="M 148,252 C 210,214 268,190 308,188 C 362,190 438,210 528,250"
        fill="none"
        stroke="#c8a84a"
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      <path
        d="M 102,308 C 210,194 466,196 578,312 C 466,416 210,420 102,308 Z"
        fill="#e8dfc8"
      />
      <circle cx="340" cy="304" r="88" fill="#3a1e06" clipPath="url(#elder-logo-mark-almond)" />
      <circle cx="335" cy="300" r="40" fill="#000000" clipPath="url(#elder-logo-mark-almond)" />
      <ellipse
        cx="322"
        cy="306"
        rx="3.5"
        ry="2.5"
        fill="#e8dfc8"
        opacity={0.55}
        transform="rotate(-15,322,306)"
        clipPath="url(#elder-logo-mark-almond)"
      />
      <path d="M 102,308 C 210,194 466,196 578,312" fill="none" stroke="#c8a84a" strokeWidth={3.4} strokeLinecap="round" />
      <path d="M 102,308 C 210,420 466,416 578,312" fill="none" stroke="#c8a84a" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}
