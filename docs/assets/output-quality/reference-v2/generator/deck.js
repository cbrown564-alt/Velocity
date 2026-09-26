import pptxgen from 'pptxgenjs';
import { readFileSync } from 'node:fs';
const D = JSON.parse(readFileSync(new URL('./deck.json', import.meta.url), 'utf8'));
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
pres.title = 'Atlas brand tracker — Wave 4 readout (reference exhibit set)';
const FONT = 'Arial';
const C = { ink: '111827', muted: '4B5563', faint: '9CA3AF', rule: 'D1D5DB', panel: 'F3F4F6',
  atlas: '0F766E', beacon: 'C2410C', meridian: '64748B', other: 'CBD5E1', w3: 'C9CED6', up: '15803D', down: 'B91C1C' };
const X = 0.6, W = 12.13;
const r0 = v => Math.round(v);
const pts = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(1) + ' pts';
const lastCh = s => s.ch[3];
let page = 0;
const BASE_ALL = 'Base: all category buyers, n=1,200 per wave (W1 Jul 2025, W2 Oct 2025, W3 Jan 2026, W4 Apr 2026). Weighted (rim: age × gender × region).';
const SIG = 'Significance: change vs previous wave, two-sided test on effective base, 95%.';

function frame(title, measure, source, notes) {
  const s = pres.addSlide(); page++;
  s.background = { color: 'FFFFFF' };
  s.addText(title, { x: X, y: 0.35, w: W, h: 0.95, fontFace: FONT, fontSize: 24, bold: true, color: C.ink, valign: 'top', margin: 0, isTextBox: true, fit: 'shrink' });
  if (measure) s.addText(measure, { x: X, y: 1.3, w: W, h: 0.35, fontFace: FONT, fontSize: 13, color: C.muted, margin: 0, isTextBox: true });
  s.addShape(pres.shapes.LINE, { x: X, y: 6.72, w: W, h: 0, line: { color: C.rule, width: 0.75 } });
  if (source) s.addText(source, { x: X, y: 6.8, w: 10.1, h: 0.5, fontFace: FONT, fontSize: 9, color: C.muted, valign: 'top', margin: 0, isTextBox: true });
  s.addText(`Atlas brand tracker · W4 · ${page}`, { x: 10.9, y: 6.8, w: 1.83, h: 0.25, fontFace: FONT, fontSize: 9, color: C.faint, align: 'right', margin: 0, isTextBox: true });
  if (notes) s.addNotes(notes);
  return s;
}
const legendKey = (s, x, y, items) => items.forEach((it, i) => {
  s.addShape(pres.shapes.RECTANGLE, { x: x + i * 1.7, y: y + 0.06, w: 0.18, h: 0.18, fill: { color: it[1] }, line: { color: it[1] } });
  s.addText(it[0], { x: x + i * 1.7 + 0.26, y, w: 1.4, h: 0.3, fontFace: FONT, fontSize: 12, color: C.ink, margin: 0, isTextBox: true });
});
const baseChart = { fontFace: FONT, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT, dataLabelFontFace: FONT,
  catAxisLabelColor: C.ink, valAxisLabelColor: C.muted, catAxisLineShow: false, valAxisLineShow: false,
  valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false, dataLabelColor: C.ink };

// 1 — Cover
{
  const s = pres.addSlide(); page++;
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.28, h: 7.5, fill: { color: C.atlas }, line: { color: C.atlas } });
  s.addText('Atlas chilled-coffee brand tracker', { x: 1.0, y: 2.2, w: 11, h: 0.9, fontFace: FONT, fontSize: 36, bold: true, color: C.ink, margin: 0, isTextBox: true });
  s.addText('Wave 4 readout · Q2 2026', { x: 1.0, y: 3.1, w: 11, h: 0.6, fontFace: FONT, fontSize: 22, color: C.atlas, margin: 0, isTextBox: true });
  s.addText('1,200 ready-to-drink chilled coffee buyers per wave · fieldwork 13–26 April 2026 · compared with W1–W3 (July 2025 to January 2026)', { x: 1.0, y: 4.0, w: 11, h: 0.4, fontFace: FONT, fontSize: 13, color: C.muted, margin: 0, isTextBox: true });
  s.addText('Reference output for Velocity Track B. Synthetic data; brands and figures are fictitious.', { x: 1.0, y: 6.7, w: 11, h: 0.3, fontFace: FONT, fontSize: 10, color: C.faint, margin: 0, isTextBox: true });
}

// 2 — Summary: level and change
{
  const a = D.aware.atlas, u = D.unaided.atlas, c = D.consider.atlas, cv = D.conv.atlas, bc = D.consider.beacon, mc = D.consider.meridian, n = D.nps[3], n3 = D.nps[2];
  const s = frame('Atlas widened its reach this quarter; Beacon turned more of its awareness into consideration',
    'Four findings from Wave 4 · level now, and change since W3',
    `${BASE_ALL} Conversion base: aware of each brand (Atlas W4 n=${cv.n[3].toLocaleString()}). NPS base: bought or drank Atlas in past 3 months (W4 n=${n.n}). ${SIG}`,
    'Each row separates the current level (large number) from its change since W3. Only changes marked "significant" pass the 95% test. The NPS change is not significant and its base is under 200.');
  const rows = [
    [`${r0(a.p[3])}%`, 'Atlas aided awareness', `${pts(lastCh(a))} · significant`, true, `Unaided awareness also rose, to ${r0(u.p[3])}% (${pts(lastCh(u))}, significant). Both were flat for the three previous waves.`],
    [`${r0(c.p[3])}%`, 'Atlas consideration (all buyers)', `${pts(lastCh(c))} · significant`, true, `Conversion among those aware held near half (${r0(cv.p[3])}%, ${pts(lastCh(cv))}, not significant): the gain came from reach.`],
    [`${r0(bc.p[3])}%`, 'Beacon consideration (all buyers)', `${pts(lastCh(bc))} · significant`, true, `Beacon moved ahead of Meridian (${r0(mc.p[3])}%, ${pts(lastCh(mc))}, not significant). Beacon now converts ${r0(D.conv.beacon.p[3])}% of those aware of it.`],
    [`${n.nps > 0 ? '+' : ''}${r0(n.nps)}`, 'Atlas Net Promoter Score', `${n3.nps > 0 ? '+' : n3.nps < 0 ? '−' : ''}${Math.abs(r0(n3.nps))} in W3 · not significant`, false, `Positive for the first time, but on ${n.n} recent buyers. Read as direction, not a confirmed shift.`],
  ];
  const y0 = 1.95, rh = 1.12;
  rows.forEach((r, i) => {
    const y = y0 + i * rh;
    s.addText(r[0], { x: X, y, w: 1.75, h: 0.8, fontFace: FONT, fontSize: 40, bold: true, color: i === 2 ? C.beacon : C.atlas, margin: 0, valign: 'middle', isTextBox: true });
    s.addText(r[1], { x: X + 1.95, y: y + 0.05, w: 3.6, h: 0.35, fontFace: FONT, fontSize: 14, bold: true, color: C.ink, margin: 0, isTextBox: true });
    s.addText(r[2], { x: X + 1.95, y: y + 0.42, w: 3.6, h: 0.3, fontFace: FONT, fontSize: 12, bold: r[3], color: r[3] ? C.up : C.muted, margin: 0, isTextBox: true });
    s.addText(r[4], { x: X + 5.8, y: y + 0.03, w: 6.3, h: 0.75, fontFace: FONT, fontSize: 13, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
    if (i < rows.length - 1) s.addShape(pres.shapes.LINE, { x: X, y: y + rh - 0.14, w: W, h: 0, line: { color: C.rule, width: 0.5 } });
  });
}

// 3 — Funnel
{
  const st = ['unaided', 'aware', 'consider', 'p3m', 'pref'];
  const lab = ['Unaided awareness', 'Aided awareness', 'Would consider', 'Bought in past 3 months', 'Preferred brand'];
  const s = frame('Atlas is better known than Beacon, but Beacon leads from consideration onwards',
    'Brand funnel, Wave 4 · % of all category buyers',
    `${BASE_ALL.replace('n=1,200 per wave (W1 Jul 2025, W2 Oct 2025, W3 Jan 2026, W4 Apr 2026)', 'W4 n=1,200, fieldwork 13–26 Apr 2026')} Each stage is a % of all buyers; not-aware respondents count as not considering or buying. Solstice (W4 aided 24%) and Cardinal (21%) are in the tables.`,
    'Stages use a common base (all buyers) so bars are comparable across the funnel. Conversion between stages is on the next slides.');
  legendKey(s, X, 1.72, [['Atlas', C.atlas], ['Beacon', C.beacon], ['Meridian', C.meridian]]);
  s.addChart(pres.charts.BAR, ['atlas', 'beacon', 'meridian'].map(b => ({ name: b[0].toUpperCase() + b.slice(1), labels: lab, values: st.map(k => D[k][b].p[3]) })),
    { ...baseChart, x: X, y: 2.1, w: W, h: 4.5, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 55, barOverlapPct: -5,
      chartColors: [C.atlas, C.beacon, C.meridian], valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 100,
      showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0"%"', dataLabelFontSize: 12, catAxisLabelFontSize: 12 });
}

// 4 — Awareness trend (single brand, two measures)
{
  const a = D.aware.atlas, u = D.unaided.atlas;
  const s = frame(`Atlas awareness rose about 6 points in Q2, the first significant move in four waves`,
    'Atlas awareness by wave · % of all category buyers',
    `${BASE_ALL} ${SIG} Aided: Q2 "heard of, even if only by name". Unaided: Q1a any unprompted mention.`,
    `Aided ${a.p.join(' / ')}; unaided ${u.p.join(' / ')} (W1–W4). Only W3→W4 is significant for either measure.`);
  s.addChart(pres.charts.LINE, [
    { name: 'Aided awareness', labels: ['W1 Q3 2025', 'W2 Q4 2025', 'W3 Q1 2026', 'W4 Q2 2026'], values: a.p },
    { name: 'Unaided awareness', labels: ['W1 Q3 2025', 'W2 Q4 2025', 'W3 Q1 2026', 'W4 Q2 2026'], values: u.p }],
    { ...baseChart, x: X, y: 1.85, w: 8.4, h: 4.7, chartColors: [C.atlas, '5EB3AA'], lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 9,
      valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 90, showValue: true, dataLabelPosition: 't', dataLabelFormatCode: '0"%"', dataLabelFontSize: 12, catAxisLabelFontSize: 12 });
  const px = X + 8.8, pw = 3.33;
  [[a, 'Aided awareness', C.atlas], [u, 'Unaided awareness', '5EB3AA']].forEach(([m, l, col], i) => {
    const y = 2.1 + i * 1.9;
    s.addShape(pres.shapes.RECTANGLE, { x: px, y, w: 0.08, h: 1.5, fill: { color: col }, line: { color: col } });
    s.addText(l, { x: px + 0.25, y, w: pw - 0.25, h: 0.3, fontFace: FONT, fontSize: 13, bold: true, color: C.ink, margin: 0, isTextBox: true });
    s.addText(`${r0(m.p[3])}%`, { x: px + 0.25, y: y + 0.32, w: pw - 0.25, h: 0.65, fontFace: FONT, fontSize: 34, bold: true, color: C.ink, margin: 0, isTextBox: true });
    s.addText(`${pts(lastCh(m))} vs W3 · significant`, { x: px + 0.25, y: y + 1.0, w: pw - 0.25, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.up, margin: 0, isTextBox: true });
  });
}

// 5 — Consideration trend (three brands) with level/change panel
{
  const bs = [['beacon', 'Beacon', C.beacon], ['meridian', 'Meridian', C.meridian], ['atlas', 'Atlas', C.atlas]];
  const s = frame('Beacon moved ahead of Meridian on consideration in Q2; Atlas also gained',
    'Would definitely or probably consider · % of all category buyers, by wave',
    `${BASE_ALL} Q3, top two of a five-point scale; not-aware respondents count as not considering. ${SIG} The W4 Beacon–Meridian gap (3 pts) is within sampling error.`,
    'Lines are not labelled at each point because the Atlas and Meridian W4 values overlap; the right-hand panel gives the W4 level and change for each brand.');
  s.addChart(pres.charts.LINE, bs.map(([k, n]) => ({ name: n, labels: ['W1 Q3 2025', 'W2 Q4 2025', 'W3 Q1 2026', 'W4 Q2 2026'], values: D.consider[k].p })),
    { ...baseChart, x: X, y: 1.85, w: 8.4, h: 4.7, chartColors: bs.map(b => b[2]), lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 8,
      valAxisMinVal: 25, valAxisMaxVal: 45, valAxisMajorUnit: 5, valAxisLabelFormatCode: '0"%"', valAxisLabelFontSize: 11,
      valGridLine: { color: 'E5E7EB', size: 0.5 }, catAxisLabelFontSize: 12 });
  const px = X + 8.8;
  s.addText([{ text: 'W4', options: { bold: true } }, { text: '      vs W3', options: {} }], { x: px + 1.55, y: 1.95, w: 1.8, h: 0.3, fontFace: FONT, fontSize: 11, color: C.muted, margin: 0, isTextBox: true });
  bs.forEach(([k, n, col], i) => {
    const m = D.consider[k], y = 2.35 + i * 0.85, ch = lastCh(m), sig = m.sig[3];
    s.addShape(pres.shapes.RECTANGLE, { x: px, y: y + 0.1, w: 0.18, h: 0.18, fill: { color: col }, line: { color: col } });
    s.addText(n, { x: px + 0.28, y, w: 1.25, h: 0.38, fontFace: FONT, fontSize: 14, bold: true, color: C.ink, margin: 0, isTextBox: true });
    s.addText(`${r0(m.p[3])}%`, { x: px + 1.55, y, w: 0.7, h: 0.38, fontFace: FONT, fontSize: 16, bold: true, color: C.ink, margin: 0, isTextBox: true });
    s.addText(pts(ch), { x: px + 2.3, y, w: 1.05, h: 0.38, fontFace: FONT, fontSize: 13, bold: sig, color: sig ? C.up : C.muted, margin: 0, isTextBox: true });
    s.addText(sig ? 'significant' : 'not significant', { x: px + 2.3, y: y + 0.35, w: 1.1, h: 0.25, fontFace: FONT, fontSize: 9, color: sig ? C.up : C.muted, margin: 0, isTextBox: true });
  });
}

// 6 — Conversion
{
  const br = [['beacon', 'Beacon'], ['solstice', 'Solstice'], ['atlas', 'Atlas'], ['cardinal', 'Cardinal'], ['meridian', 'Meridian']];
  const lab = br.map(([k, n]) => `${n}${D.conv[k].sig[3] ? ' ▲' : ''}`);
  const s = frame('Atlas’s gain came from reach, not persuasion: about half of those aware would consider it, as before',
    'Would consider, among buyers aware of each brand · % by wave',
    `Base: category buyers aware of each brand, W4 unweighted n: Beacon ${D.conv.beacon.n[3]}, Solstice ${D.conv.solstice.n[3]}, Atlas ${D.conv.atlas.n[3]}, Cardinal ${D.conv.cardinal.n[3]}, Meridian ${D.conv.meridian.n[3]}. Weighted. Q3 top two box. ▲ significant change vs W3 at 95%.`,
    'Conversion = consideration among those aware. Atlas moved +2.2 pts (not significant); Beacon +7.9 pts (significant).');
  legendKey(s, X, 1.72, [['W3 Q1 2026', C.w3], ['W4 Q2 2026', C.ink]]);
  s.addChart(pres.charts.BAR, [
    { name: 'W3 Q1 2026', labels: lab, values: br.map(([k]) => D.conv[k].p[2]) },
    { name: 'W4 Q2 2026', labels: lab, values: br.map(([k]) => D.conv[k].p[3]) }],
    { ...baseChart, x: X, y: 2.1, w: W, h: 4.5, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 70, barOverlapPct: -5,
      chartColors: [C.w3, C.ink], valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 80,
      showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0"%"', dataLabelFontSize: 12, catAxisLabelFontSize: 13 });
}

// 7 — Image
{
  const at = D.image.atlas, be = D.image.beacon;
  const attrs = Object.keys(at).sort((p, q) => at[q].p - at[p].p);
  const lab = attrs.map(a => a + (at[a].sig ? `  (Atlas ${pts(at[a].ch)} ▲)` : ''));
  const s = frame('Atlas gained on ‘innovative’, but still trails Beacon on every attribute except ‘premium’',
    'Agree the brand… (strongly or somewhat) · % of buyers aware of each brand, Wave 4',
    `Base: W4 category buyers aware of each brand: Atlas n=${at['Tastes great'].n}, Beacon n=${be['Tastes great'].n}. Weighted. Q7, top two of a five-point scale; don’t know kept in the base. ▲ significant change vs W3 at 95%. Meridian is in the tables (T15).`,
    'Bases differ by brand (each brand is rated by those aware of it), so the Atlas–Beacon gap partly reflects who knows each brand. Only Atlas “innovative” changed significantly since W3.');
  legendKey(s, X, 1.72, [['Atlas', C.atlas], ['Beacon', C.beacon]]);
  s.addChart(pres.charts.BAR, [
    { name: 'Atlas', labels: lab, values: attrs.map(a => at[a].p) },
    { name: 'Beacon', labels: lab, values: attrs.map(a => be[a].p) }],
    { ...baseChart, x: X, y: 2.05, w: W, h: 4.6, barDir: 'bar', barGrouping: 'clustered', barGapWidthPct: 45, barOverlapPct: 0,
      chartColors: [C.atlas, C.beacon], valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 70, catAxisOrientation: 'maxMin',
      showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0"%"', dataLabelFontSize: 11, catAxisLabelFontSize: 12 });
}

// 8 — Segment table
{
  const s = frame('Growth-segment and younger buyers drove Atlas’s awareness gain; Core and Value barely moved',
    'Atlas awareness by consumer segment and age · % of category buyers in each group',
    `Base: category buyers in each group; unweighted n shown (same in W3 and W4). Weighted. ▲ significant change vs W3 at 95%. Aided: Q2. Unaided: Q1a any mention.`,
    'Groups are compared across waves only; within-wave differences between groups are in tables T2–T3 (column letters).');
  const hdr = (t, o = {}) => ({ text: t, options: { bold: true, color: C.muted, fontSize: 11, align: 'right', valign: 'bottom', ...o } });
  const rows = [[hdr('', { align: 'left' }), hdr('Buyers (n)'), hdr('Aided W3'), hdr('Aided W4'), hdr('Change'), hdr('Unaided W3'), hdr('Unaided W4'), hdr('Change')]];
  let prevGroup = null;
  D.seg.forEach(r => {
    if (r.group !== prevGroup && r.group !== 'total') {
      rows.push([{ text: r.group === 'segment' ? 'Consumer segment' : 'Age', options: { bold: true, color: C.ink, fontSize: 11, colspan: 8, fill: { color: C.panel } } }]);
    }
    prevGroup = r.group;
    const tot = r.group === 'total';
    const chg = m => ({ text: pts(m.ch) + (m.sig ? ' ▲' : ''), options: { align: 'right', bold: m.sig, color: m.sig ? C.up : C.muted } });
    rows.push([
      { text: r.label, options: { bold: tot, indent: tot ? 0 : 1 } },
      { text: r.aware.n4.toLocaleString(), options: { align: 'right', color: C.muted } },
      { text: `${r0(r.aware.w3)}%`, options: { align: 'right', color: C.muted } },
      { text: `${r0(r.aware.w4)}%`, options: { align: 'right', bold: true } }, chg(r.aware),
      { text: `${r0(r.unaided.w3)}%`, options: { align: 'right', color: C.muted } },
      { text: `${r0(r.unaided.w4)}%`, options: { align: 'right', bold: true } }, chg(r.unaided)]);
  });
  s.addTable(rows, { x: X, y: 1.9, w: W, colW: [3.13, 1.2, 1.25, 1.25, 1.4, 1.3, 1.3, 1.3], fontFace: FONT, fontSize: 14, color: C.ink,
    rowH: 0.44, border: { type: 'solid', pt: 0.5, color: 'E5E7EB' }, valign: 'middle', margin: [0, 0.08, 0, 0.08] });
}

// 9 — NPS
{
  const s = frame('Atlas’s NPS turned positive in W4, but on a small base the change is not yet significant',
    'Likelihood to recommend Atlas (0–10) · % of recent Atlas buyers, by wave',
    `Base: bought or drank Atlas in the past 3 months: W1 n=${D.nps[0].n}, W2 n=${D.nps[1].n}, W3 n=${D.nps[2].n}, W4 n=${D.nps[3].n}. Weighted. NPS = % promoters (9–10) minus % detractors (0–6). W4 vs W3 not significant (p=${D.nps_p.toFixed(2)}); W4 vs W1 p=${D.nps_p_w1.toFixed(2)}.`,
    'Promoters rose and detractors fell steadily over four waves; the trend is consistent but each wave-on-wave step is within sampling error.');
  const lab = D.nps.map(n => `${D.labels[n.wave]}   NPS ${n.nps > 0 ? '+' : n.nps < 0 ? '−' : ''}${Math.abs(r0(n.nps))}`);
  legendKey(s, X, 1.72, [['Detractors 0–6', 'E3B6B1'], ['Passives 7–8', 'D9DDE3'], ['Promoters 9–10', '5DB8AC']]);
  s.addChart(pres.charts.BAR, [
    { name: 'Detractors (0–6)', labels: lab, values: D.nps.map(n => n.det) },
    { name: 'Passives (7–8)', labels: lab, values: D.nps.map(n => n.pas) },
    { name: 'Promoters (9–10)', labels: lab, values: D.nps.map(n => n.pro) }],
    { ...baseChart, x: X, y: 2.1, w: W, h: 4.4, barDir: 'bar', barGrouping: 'percentStacked', barGapWidthPct: 45,
      chartColors: ['E3B6B1', 'D9DDE3', '5DB8AC'], valAxisHidden: true, catAxisOrientation: 'maxMin',
      showValue: true, dataLabelPosition: 'ctr', dataLabelFormatCode: '0"%"', dataLabelFontSize: 12, catAxisLabelFontSize: 13 });
}

// 10 — Method
{
  const s = frame('About this study', null, 'Synthetic tracker used for Velocity reference outputs. Full tables: Atlas_W4_tables_reference.xlsx.', null);
  const L = [['Sample', 'Adults who bought ready-to-drink chilled coffee in the past 3 months. 1,200 per wave, quota-controlled by segment and age.'],
    ['Fieldwork', 'W1 14–27 Jul 2025 · W2 13–26 Oct 2025 · W3 12–25 Jan 2026 · W4 13–26 Apr 2026. Each wave is a fresh sample.'],
    ['Weighting', 'Rim weighting to age × gender × region. Design effect about 1.12; effective sample about 1,070 per wave.'],
    ['Significance', 'Two-sided z-tests on weighted proportions using effective bases, 95% confidence. No adjustment for multiple comparisons. Groups under 50 are shown as indicative and not tested.'],
    ['Measures', 'Consideration and usage are shown as % of all buyers unless labelled “among aware”. Top two box = the two most positive points of a five-point scale.']];
  L.forEach(([k, v], i) => {
    s.addText(k, { x: X, y: 1.5 + i * 0.95, w: 2.2, h: 0.8, fontFace: FONT, fontSize: 14, bold: true, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
    s.addText(v, { x: X + 2.4, y: 1.5 + i * 0.95, w: 9.7, h: 0.8, fontFace: FONT, fontSize: 14, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
  });
}
pres.writeFile({ fileName: 'Atlas_W4_readout_reference.pptx' }).then(f => console.log('wrote', f));
