// lib/i18n/translate.ts
//
// The translation engine. No React, no browser APIs: used by the client
// context, by server routes, and by tests.
//
// COMPLETENESS IS A COMPILE ERROR
// English (messages/en.ts) is the source of truth and is declared `as const`.
// Every other locale is typed `Messages = Record<MessageKey, string>`, so a
// locale file that is missing a key, or has an extra one, fails `tsc`. There is
// no silent English fallback to hide a gap: CONSOLIDATION.md 4.4 calls partial
// translation of safety copy a release blocker, and this is the guard.
//
// PLACEHOLDERS ARE TYPED
// A message like "Pairings kept in {where}, as {figure}" requires
// `t('x', { where, figure })`; passing the wrong names is a type error. The
// parity test additionally checks every locale uses the same placeholders as
// English (a translation may reorder them, never drop or invent one).

import type { en } from './messages/en';

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

/** "a {x} b {y}" -> "x" | "y" */
export type Placeholders<S extends string> = S extends `${string}{${infer P}}${infer Rest}`
  ? P | Placeholders<Rest>
  : never;

export type Vars<K extends MessageKey> = Record<Placeholders<(typeof en)[K]>, string | number>;

export type TArgs<K extends MessageKey> = [Placeholders<(typeof en)[K]>] extends [never]
  ? [vars?: undefined]
  : [vars: Vars<K>];

export type TFunction = <K extends MessageKey>(key: K, ...args: TArgs<K>) => string;

/** Message keys that come in `_one` / `_other` pairs, as their shared base. */
export type PluralBase = {
  [K in MessageKey]: K extends `${infer B}_one` ? B : never;
}[MessageKey];

const TOKEN = /\{([a-zA-Z0-9_]+)\}/g;

/** Replace {name} tokens. An unknown token is left visible rather than dropped,
 *  so a bad template is noticed in review, not shipped as a silent hole. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(TOKEN, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

/** The placeholder names a template uses, in order of first appearance. */
export function placeholdersOf(template: string): string[] {
  const seen: string[] = [];
  for (const m of template.matchAll(TOKEN)) if (!seen.includes(m[1])) seen.push(m[1]);
  return seen;
}

/**
 * Split a template into literal strings and named slots, for rich text where a
 * placeholder is filled by a styled element rather than a plain string.
 * "The {lineage} speaks" -> ["The ", {slot:"lineage"}, " speaks"]
 */
export function splitTemplate(template: string): Array<string | { slot: string }> {
  const out: Array<string | { slot: string }> = [];
  let last = 0;
  for (const m of template.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(template.slice(last, at));
    out.push({ slot: m[1] });
    last = at + m[0].length;
  }
  if (last < template.length) out.push(template.slice(last));
  return out;
}

/** CLDR plural category for a count: 'one' or 'other' is all these eleven languages
 *  need for the sentences we have (K'iche', Japanese, Korean and Chinese do not mark
 *  number on the noun; their `_one` and `_other` strings are simply identical). */
export function pluralCategory(intlLocale: string, count: number): 'one' | 'other' {
  try {
    return new Intl.PluralRules(intlLocale).select(count) === 'one' ? 'one' : 'other';
  } catch {
    return count === 1 ? 'one' : 'other';
  }
}

/** Build a `t` bound to one catalog. */
export function createTranslator(messages: Messages): TFunction {
  return ((key: MessageKey, vars?: Record<string, string | number>) =>
    interpolate(messages[key], vars)) as TFunction;
}

/** Pick the `_one`/`_other` variant for `count` and interpolate (`{count}` is
 *  always supplied). */
export function pluralize(
  messages: Messages,
  intlLocale: string,
  base: PluralBase,
  count: number,
  vars?: Record<string, string | number>,
): string {
  const key = `${base}_${pluralCategory(intlLocale, count)}` as MessageKey;
  return interpolate(messages[key], { count, ...vars });
}
