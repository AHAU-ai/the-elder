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

  // ── PairingsView (FC-F): the seeker's own pairings, and the means to release them ──
  {
    const { PairingsView } = await import('../app/components/FigureMappings');
    const { groupPairings } = await import('./figureClient');
    const C1 = '11111111-1111-4111-8111-111111111111';
    const C2 = '22222222-2222-4222-8222-222222222222';
    const mk = (over: Record<string, unknown>) => ({
      id: 1, chainId: C1, lineageKey: 'maya', mythTitle: 'The Twins', figureLabel: 'The Hero Twin', subjectKind: 'person' as const,
      subjectLabel: 'my sister', counterpartLabel: 'the Maize Maiden', counterpartBasis: 'model_report' as const,
      confirmedAt: '2026-10-05T12:00:00.000Z', ...over,
    });
    const rows = [
      mk({ id: 1, confirmedAt: '2026-10-03T00:00:00.000Z' }),
      mk({ id: 2, subjectLabel: 'my brother', counterpartLabel: 'the Elder Twin', counterpartBasis: 'corpus', confirmedAt: '2026-10-04T00:00:00.000Z' }),
      mk({ id: 3, chainId: C2, lineageKey: 'norse', mythTitle: 'The Wanderer', figureLabel: 'The Seeress', subjectLabel: 'my aunt', counterpartLabel: 'the Norn', confirmedAt: '2026-10-05T00:00:00.000Z' }),
    ];
    const noop2 = () => {};
    const base = { groups: groupPairings(rows as never), skipped: 0, confirming: null, working: false, notice: null,
      onAsk: noop2, onCancel: noop2, onRemove: noop2, onReleaseChain: noop2, onReleaseAll: noop2 };
    const view = (over: Record<string, unknown> = {}) => renderToStaticMarkup(h(PairingsView, { ...base, ...over } as never));

    // empty
    const empty = view({ groups: [] });
    assert.ok(empty.includes('Nothing is kept here yet. A pairing is kept only when you say that it fits.'), 'warm, short empty state');
    assert.deepEqual(buttons(empty), [], 'nothing to release when nothing is kept');

    // loaded
    const html = view();
    assert.equal((html.match(/<section\b/g) ?? []).length, 2, 'one section per myth');
    assert.ok(html.indexOf('my aunt') < html.indexOf('my sister'), 'the myth with the newest pairing comes first');
    assert.ok(html.includes('“my sister”') && html.includes('“the Maize Maiden”') && html.includes('echoes'), 'each pairing in the seeker\'s words');
    assert.ok(html.includes('As “The Hero Twin”') && html.includes('The Twins'), 'the figure and myth are named');
    assert.ok(html.includes("the counterpart is the Elder’s own recollection of the tradition, not a cited passage"), 'a model-reported counterpart says so');
    assert.equal((html.match(/not a cited passage/g) ?? []).length, 2, 'but a corpus-backed one does not (two of the three are model reports)');
    assert.ok(html.includes('Kept '), 'dated');
    const labels = buttons(html).map(b => b.label);
    assert.equal(labels.filter(l => l === 'Remove').length, 3, 'a Remove for every pairing');
    assert.equal(labels.filter(l => /^Release this myth/.test(l)).length, 2, 'one release per myth');
    assert.ok(labels.includes('Release everything'), 'and release everything');
    assert.ok(buttons(html).filter(b => b.label === 'Remove').every(b => /aria-label="Remove: [^"]*echoes[^"]*"/.test(b.attrs)), 'each Remove names its pairing for assistive tech');
    assert.ok(html.includes('role="status"') && html.includes('aria-live="polite"'), 'results are announced politely');
    assert.ok(/<ul\b/.test(html) && /<li\b/.test(html), 'lists are real lists');

    // no export, download or copy: pairings describe third parties
    assert.ok(!/download|export|copy|share|href="blob|<a\b[^>]*download/i.test(html.replace(/Release everything/g, '')), 'no export, download, copy or share control');

    // confirmation steps: equal weight, plain words
    const rowAsk = view({ confirming: { kind: 'row', id: 2 } });
    assert.ok(rowAsk.includes('Remove this pairing?'), 'asks before removing one');
    const rb = buttons(rowAsk).filter(b => (b.label === 'Remove' && !/aria-label/.test(b.attrs)) || b.label === 'Keep it');
    assert.deepEqual(rb.map(b => b.label).sort(), ['Keep it', 'Remove'], 'both answers offered');
    assert.equal(styleOf(rb[0].attrs), styleOf(rb[1].attrs), 'the two answers carry equal visual weight');
    assert.equal((rowAsk.match(/>Remove this pairing\?</g) ?? []).length, 1, 'only the chosen pairing asks');
    assert.ok(buttons(rowAsk).filter(b => /^Release/.test(b.label)).every(b => /disabled/.test(b.attrs)), 'while one step waits, the other release controls are disabled');
    assert.ok(buttons(rowAsk).filter(b => b.label === 'Remove' && /aria-label/.test(b.attrs)).every(b => /disabled/.test(b.attrs)), 'and the other Remove buttons');

    const chainAsk = view({ confirming: { kind: 'chain', chainId: C1 } });
    assert.ok(chainAsk.includes('Release all 2 pairings kept in this myth?'), 'names how many a myth release takes');
    assert.ok(buttons(chainAsk).some(b => b.label === 'Keep them') && buttons(chainAsk).some(b => b.label === 'Release'));
    const allAsk = view({ confirming: { kind: 'all' } });
    assert.ok(allAsk.includes('Release every pairing the fire holds for you? This cannot be undone.'), 'says release-all cannot be undone');
    assert.ok(buttons(allAsk).some(b => b.label === 'Release everything') && buttons(allAsk).some(b => b.label === 'Keep them'));

    // working: nothing can be pressed twice
    const working = view({ confirming: { kind: 'all' }, working: true });
    assert.ok(buttons(working).every(b => /disabled/.test(b.attrs)), 'while a request is in flight every control is disabled');

    // notice and skipped
    assert.ok(view({ notice: 'Released 2 pairings.' }).includes('Released 2 pairings.'), 'the notice is shown');
    const skipped = view({ groups: [], skipped: 2 });
    assert.ok(skipped.includes('2 pairings could not be shown here. You can still release everything below.'), 'unreadable rows are said aloud, never hidden');
    assert.ok(buttons(skipped).some(b => b.label === 'Release everything'), 'and can still be released');
    assert.ok(!skipped.includes('Nothing is kept here yet'), 'unreadable rows are never presented as "nothing kept"');
    assert.ok(view({ groups: [], skipped: 1 }).includes('One pairing could not be shown here.'));

    // hostile text
    const hostileRows = [mk({ id: 9, subjectLabel: '<img src=x onerror=alert(1)>', counterpartLabel: '</li><script>1</script>', figureLabel: '<b>fig</b>', mythTitle: '<i>myth</i>' })];
    const hostile = view({ groups: groupPairings(hostileRows as never) });
    assert.ok(!hostile.includes('<img') && !hostile.includes('<script>') && !hostile.includes('<b>fig') && !hostile.includes('<i>myth'), 'labels render only as text');
    assert.ok(hostile.includes('&lt;img'), 'escaped');
  }

  console.log('figureComponents tests passed');
}

main().catch(err => { console.error(err); process.exit(1); });
