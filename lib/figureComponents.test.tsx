/**
 * figureComponents.test.tsx -- hermetic server-render tests for the two Figure
 * Continuity components (app/components/FigureArrivalChoice.tsx and
 * MappingOfferControls.tsx). They render the INITIAL state with
 * react-dom/server, so they prove structure, equal weight between answers,
 * escaping of seeker/model text, accessibility attributes, and the resolved
 * states the parent restores after a remount. Interaction (the real clicks,
 * the network calls) is covered by the browser walkthrough.
 *
 * Run: npx tsx lib/figureComponents.test.tsx
 */
import assert from 'node:assert/strict';
import * as ReactNS from 'react';

// tsx uses the classic JSX transform here; the components rely on a global React.
(globalThis as unknown as { React: typeof ReactNS }).React = ReactNS;

async function main() {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: FigureArrivalChoice } = await import('../app/components/FigureArrivalChoice');
  const { default: MappingOfferControls } = await import('../app/components/MappingOfferControls');
  const h = ReactNS.createElement;
  const noop = () => {};

  const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>(.*?)<\/button>/g)].map(m => ({ attrs: m[1], label: m[2] }));
  const styleOf = (attrs: string) => (attrs.match(/style="([^"]*)"/) ?? [])[1] ?? '';

  // ── FigureArrivalChoice ──
  {
    const html = renderToStaticMarkup(h(FigureArrivalChoice, { figureLabel: 'The Hero Twin', accent: '#c8601a', onContinue: noop, onStepOut: noop, onChoose: noop }));
    const b = buttons(html);
    assert.deepEqual(b.map(x => x.label), ['Continue as The Hero Twin', 'Step out of the figure for this sitting', 'Choose a different figure'], 'three choices, in order');
    assert.equal(new Set(b.map(x => styleOf(x.attrs))).size, 1, 'the three choices carry identical styling: equal weight, no default pressed');
    assert.ok(b.every(x => /type="button"/.test(x.attrs)), 'real buttons that never submit a form');
    assert.ok(html.includes('role="group"') && html.includes('aria-labelledby="figure-arrival-heading"') && html.includes('id="figure-arrival-heading"'), 'a labelled group');
    assert.ok(html.includes('&ldquo;') === false && html.includes('“The Hero Twin”'), 'the figure is shown in its own words');
    assert.ok(html.includes('Stepping out leaves the figure, and anything you have kept, untouched.'), 'says what stepping out does');
    assert.ok(html.includes('You choose again each time you return.'), 'says the choice is not persisted');
    assert.ok(!/autofocus/i.test(html), 'does not steal focus');
  }
  {
    const hostile = '<script>alert(1)</script> & "quoted"';
    const html = renderToStaticMarkup(h(FigureArrivalChoice, { figureLabel: hostile, onContinue: noop, onStepOut: noop, onChoose: noop }));
    assert.ok(!html.includes('<script>'), 'a figure label can never inject markup');
    assert.ok(html.includes('&lt;script&gt;'), 'it is escaped, shown as text');
  }

  // ── MappingOfferControls: initial state ──
  const offer = { id: 7, kind: 'person' as const, subject: 'my sister', counterpart: 'the Maize Maiden' };
  {
    const html = renderToStaticMarkup(h(MappingOfferControls, { offer, accent: '#c8601a' }));
    const b = buttons(html);
    assert.deepEqual(b.map(x => x.label), ['That fits', 'Not quite'], 'exactly the two answers');
    assert.equal(styleOf(b[0].attrs), styleOf(b[1].attrs), '"That fits" and "Not quite" carry equal visual weight');
    assert.ok(b.every(x => /type="button"/.test(x.attrs) && !/disabled/.test(x.attrs)), 'enabled real buttons');
    assert.ok(html.includes('role="group"') && html.includes('aria-label="Keep this pairing?"'), 'a labelled group');
    assert.ok(html.includes('role="status"') && html.includes('aria-live="polite"'), 'outcomes are announced politely');
    assert.ok(html.includes('To keep: “my sister” echoes “the Maize Maiden”.'), 'shows exactly what would be kept, in the seeker\'s words');
    assert.ok(html.includes('Nothing is kept unless you say so.'), 'says nothing is kept without the answer');
    assert.ok(/opacity:\s*0[;"]/.test(styleOf((html.match(/<div[^>]*role="group"[^>]*>/) ?? [''])[0])), 'starts transparent and fades in (the global reduced-motion rule collapses the fade)');
    assert.ok(!/autofocus/i.test(html) && !/<audio|<video|new Audio/i.test(html), 'no focus theft, no sound');
  }
  {
    const html = renderToStaticMarkup(h(MappingOfferControls, { offer: { ...offer, subject: '<img src=x onerror=alert(1)>', counterpart: '</div><script>1</script>' } }));
    assert.ok(!html.includes('<img') && !html.includes('<script>') && !html.includes('</div><script'), 'labels from the model are only ever rendered as text');
    assert.ok(html.includes('&lt;img'), 'escaped');
  }

  // ── resolved states restored by the parent after a remount: never asked again ──
  for (const [result, text] of [
    [{ kind: 'confirmed' }, 'kept'],
    [{ kind: 'declined' }, 'set down'],
    [{ kind: 'passed' }, 'that one has passed'],
    [{ kind: 'cap', message: 'The fire keeps 30 pairings at a time.' }, 'The fire keeps 30 pairings at a time.'],
  ] as Array<[Parameters<typeof MappingOfferControls>[0]['result'], string]>) {
    const html = renderToStaticMarkup(h(MappingOfferControls, { offer, result }));
    assert.deepEqual(buttons(html), [], `answered (${result!.kind}): no buttons, the offer is not asked again`);
    assert.ok(html.includes(text), `answered (${result!.kind}): says "${text}"`);
    assert.ok(!html.includes('To keep:'), `answered (${result!.kind}): the question is gone`);
  }
  {
    const html = renderToStaticMarkup(h(MappingOfferControls, { offer, result: { kind: 'cap', message: '<b>x</b>' } }));
    assert.ok(!html.includes('<b>x</b>') && html.includes('&lt;b&gt;x&lt;/b&gt;'), 'a server message is escaped too');
  }

  console.log('figureComponents tests passed');
}

main().catch(err => { console.error(err); process.exit(1); });
