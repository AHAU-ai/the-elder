// lib/i18n/languageDirective.ts
//
// The one sentence-block that tells a model which language to answer in.
// Shared by the main system prompt (lib/system-prompt-builder.ts) and by every
// other route that asks a model to write for the seeker, so they cannot drift:
// before this existed only /api/divine spoke the chosen language and the
// client never even sent it.
//
// `languageName` must already be one of the eleven validated names
// (languageNameFromInput in ./languages.ts); it is interpolated into a prompt.

export function languageDirective(languageName: string): string {
  if (languageName === 'English') return '';
  return `━━━ LANGUAGE DIRECTIVE — NON-NEGOTIABLE ━━━\nYou must conduct this entire session in ${languageName}.\nAll questions, responses, and the full Reading must be delivered in ${languageName}.\nDo not switch languages under any circumstances.\nIf the seeker writes in another language, understand them — then respond in ${languageName}.`;
}
