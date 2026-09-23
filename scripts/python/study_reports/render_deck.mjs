// Render a deck spec (JSON written by build.py) to an editable PowerPoint file.
// Usage: node render_deck.mjs deck.json out.pptx   (needs pptxgenjs; run from the repo so node_modules resolves)
import fs from 'node:fs';
import pptxgen from 'pptxgenjs';
const [, , specPath, outPath] = process.argv;
const D = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.title = D.meta.title;
const FONT = 'Arial';
const C = {
  ink: '111827',
  muted: '4B5563',
  faint: '9CA3AF',
  rule: 'D1D5DB',
  panel: 'F3F4F6',
  up: '15803D',
  down: 'B91C1C',
  accent: '1F3A5F',
};
const X = 0.6,
  W = 12.13;
let page = 0;
const base = {
  fontFace: FONT,
  catAxisLabelFontFace: FONT,
  valAxisLabelFontFace: FONT,
  dataLabelFontFace: FONT,
  catAxisLabelColor: C.ink,
  valAxisLabelColor: C.muted,
  catAxisLineShow: false,
  valAxisLineShow: false,
  valGridLine: { style: 'none' },
  catGridLine: { style: 'none' },
  showLegend: false,
  dataLabelColor: C.ink,
};
const txt = (s, t, o) => s.addText(t, { fontFace: FONT, margin: 0, isTextBox: true, color: C.ink, ...o });

function frame(sl) {
  const s = pres.addSlide();
  page++;
  txt(s, sl.title, { x: X, y: 0.35, w: W, h: 0.95, fontSize: 22, bold: true, valign: 'top', fit: 'shrink' });
  if (sl.measure) txt(s, sl.measure, { x: X, y: 1.32, w: W, h: 0.32, fontSize: 12, color: C.muted, fit: 'shrink' });
  s.addShape(pres.shapes.LINE, { x: X, y: 6.72, w: W, h: 0, line: { color: C.rule, width: 0.75 } });
  if (sl.source)
    txt(s, sl.source, { x: X, y: 6.8, w: 10.1, h: 0.55, fontSize: 8.5, color: C.muted, valign: 'top', fit: 'shrink' });
  txt(s, `${D.meta.footer} · ${page}`, {
    x: 10.8,
    y: 6.8,
    w: 1.93,
    h: 0.25,
    fontSize: 8.5,
    color: C.faint,
    align: 'right',
  });
  if (sl.notes) s.addNotes(sl.notes);
  return s;
}
function legend(s, x, y, items, maxW = W) {
  const widths = items.map(([n]) => Math.min(3.4, 0.095 * n.length + 0.2));
  const gap = 0.45,
    total = widths.reduce((a, b) => a + b, 0) + items.length * (0.25 + gap);
  const k = total > maxW ? maxW / total : 1;
  let cx = x;
  items.forEach(([n, col], i) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: cx,
      y: y + 0.07,
      w: 0.17,
      h: 0.17,
      fill: { color: col },
      line: { color: col },
    });
    txt(s, n, { x: cx + 0.25, y, w: widths[i] * k + 0.1, h: 0.3, fontSize: k < 1 ? 10 : 11, fit: 'shrink' });
    cx += (widths[i] + 0.25 + gap) * k;
  });
}
const chg = (it) => (it.sig === true ? (it.direction === 'down' ? C.down : C.up) : C.muted);

const R = {
  cover(sl) {
    const s = pres.addSlide();
    page++;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0,
      y: 0,
      w: 0.28,
      h: 7.5,
      fill: { color: C.accent },
      line: { color: C.accent },
    });
    txt(s, sl.title, { x: 1.0, y: 2.2, w: 11, h: 0.9, fontSize: 34, bold: true });
    txt(s, sl.subtitle || '', { x: 1.0, y: 3.1, w: 11, h: 0.6, fontSize: 20, color: C.accent });
    txt(s, sl.meta || '', { x: 1.0, y: 3.95, w: 11, h: 0.4, fontSize: 13, color: C.muted });
    txt(s, sl.footnote || '', { x: 1.0, y: 6.7, w: 11, h: 0.3, fontSize: 10, color: C.faint });
  },
  findings(sl) {
    const s = frame(sl);
    const n = sl.rows.length;
    const rh = Math.min(1.2, 4.9 / n);
    const y0 = 1.85;
    sl.rows.forEach((r, i) => {
      const y = y0 + i * rh;
      txt(s, r.value, {
        x: X,
        y,
        w: 1.8,
        h: rh * 0.7,
        fontSize: 34,
        bold: true,
        color: r.color || C.accent,
        valign: 'middle',
        fit: 'shrink',
      });
      txt(s, r.label, {
        x: X + 2.0,
        y: y + 0.04,
        w: 3.7,
        h: 0.5,
        fontSize: 13,
        bold: true,
        valign: 'top',
        fit: 'shrink',
      });
      txt(s, r.change, {
        x: X + 2.0,
        y: y + 0.5,
        w: 3.7,
        h: 0.3,
        fontSize: 11,
        bold: r.sig === true,
        color: chg(r),
        fit: 'shrink',
      });
      txt(s, r.text, { x: X + 5.9, y: y + 0.04, w: 6.2, h: rh - 0.22, fontSize: 12.5, valign: 'top', fit: 'shrink' });
      if (i < n - 1)
        s.addShape(pres.shapes.LINE, { x: X, y: y + rh - 0.1, w: W, h: 0, line: { color: C.rule, width: 0.5 } });
    });
  },
  bar(sl) {
    const s = frame(sl);
    if (sl.legend)
      legend(
        s,
        X,
        1.72,
        sl.series.map((x) => [x.name, x.color]),
      );
    const horiz = sl.dir === 'bar';
    s.addChart(
      pres.charts.BAR,
      sl.series.map((x) => ({ name: x.name, labels: sl.categories, values: x.values.map((v) => v ?? 0) })),
      {
        ...base,
        x: X,
        y: 2.1,
        w: W,
        h: 4.5,
        barDir: horiz ? 'bar' : 'col',
        barGrouping: 'clustered',
        barGapWidthPct: 60,
        barOverlapPct: -5,
        chartColors: sl.series.map((x) => x.color),
        valAxisHidden: true,
        valAxisMinVal: 0,
        valAxisMaxVal: sl.max || undefined,
        catAxisOrientation: horiz ? 'maxMin' : 'minMax',
        showValue: true,
        dataLabelPosition: 'outEnd',
        dataLabelFormatCode: sl.fmt || '0',
        dataLabelFontSize: sl.series.length * sl.categories.length > 24 ? 10 : 12,
        catAxisLabelFontSize: 12,
      },
    );
  },
  stacked(sl) {
    const s = frame(sl);
    legend(
      s,
      X,
      1.72,
      sl.series.map((x) => [x.name, x.color]),
    );
    s.addChart(
      pres.charts.BAR,
      sl.series.map((x) => ({ name: x.name, labels: sl.categories, values: x.values.map((v) => v ?? 0) })),
      {
        ...base,
        x: X,
        y: 2.15,
        w: W,
        h: 4.4,
        barDir: 'bar',
        barGrouping: 'percentStacked',
        barGapWidthPct: 45,
        catAxisOrientation: 'maxMin',
        chartColors: sl.series.map((x) => x.color),
        valAxisHidden: true,
        showValue: true,
        dataLabelPosition: 'ctr',
        dataLabelFormatCode: '0"%"',
        dataLabelFontSize: 11,
        catAxisLabelFontSize: 13,
      },
    );
  },
  line(sl) {
    const s = frame(sl);
    const hasPanel = sl.panel && sl.panel.length;
    const cw = hasPanel ? 8.2 : W;
    legend(
      s,
      X,
      1.72,
      sl.series.map((x) => [x.name, x.color]),
    );
    const all = sl.series.flatMap((x) => x.values).filter((v) => v !== null);
    let lo = Math.min(...all),
      hi = Math.max(...all);
    const span = Math.max(hi - lo, (sl.fmt || '').includes('.') ? 1 : 4);
    const step = span <= 3 ? 0.5 : span <= 12 ? 2 : 5;
    const pad = span * 0.3;
    lo = Math.floor((lo - pad) / step) * step;
    hi = Math.ceil((hi + pad) / step) * step;
    if (sl.fmt && sl.fmt.includes('%')) {
      lo = Math.max(0, lo);
      hi = Math.min(100, hi);
    }
    s.addChart(
      pres.charts.LINE,
      sl.series.map((x) => ({ name: x.name, labels: sl.categories, values: x.values })),
      {
        ...base,
        x: X,
        y: 2.1,
        w: cw,
        h: 4.5,
        chartColors: sl.series.map((x) => x.color),
        lineSize: 3,
        lineDataSymbol: 'circle',
        lineDataSymbolSize: 8,
        valAxisMinVal: lo,
        valAxisMaxVal: hi,
        valAxisHidden: !!sl.labels,
        valGridLine: sl.labels ? { style: 'none' } : { color: 'E5E7EB', size: 0.5 },
        valAxisLabelFormatCode: sl.fmt || '0',
        showValue: !!sl.labels,
        dataLabelPosition: 't',
        dataLabelFormatCode: sl.fmt || '0',
        dataLabelFontSize: 11,
        catAxisLabelFontSize: 12,
      },
    );
    if (hasPanel) {
      const px = X + cw + 0.35,
        pw = W - cw - 0.35;
      txt(s, sl.panel_title || '', { x: px, y: 2.05, w: pw, h: 0.3, fontSize: 10, color: C.muted });
      const ph = Math.min(0.95, 4.2 / sl.panel.length);
      sl.panel.forEach((p, i) => {
        const y = 2.45 + i * ph;
        s.addShape(pres.shapes.RECTANGLE, {
          x: px,
          y: y + 0.03,
          w: 0.07,
          h: ph - 0.2,
          fill: { color: p.color || C.accent },
          line: { color: p.color || C.accent },
        });
        txt(s, p.name, { x: px + 0.2, y, w: pw - 0.2, h: 0.28, fontSize: 11, bold: true, fit: 'shrink' });
        txt(
          s,
          [
            { text: p.value, options: { fontSize: 18, bold: true } },
            {
              text: '   ' + p.change + (p.sig === false ? ' (not sig.)' : ''),
              options: { fontSize: 10.5, bold: p.sig === true, color: chg(p) },
            },
          ],
          { x: px + 0.2, y: y + 0.28, w: pw - 0.2, h: 0.42, fit: 'shrink' },
        );
      });
    }
  },
  table(sl) {
    const s = frame(sl);
    const hdr = sl.header.map((h, j) => ({
      text: h,
      options: { bold: true, color: C.muted, fontSize: 11, align: j ? 'right' : 'left', valign: 'bottom' },
    }));
    const rows = [hdr].concat(
      sl.rows.map((r) =>
        r.map((c, j) => {
          if (typeof c === 'string') return { text: c, options: { align: j ? 'right' : 'left' } };
          return {
            text: c.text,
            options: {
              bold: !!c.bold,
              align: c.align || (j ? 'right' : 'left'),
              color: c.sig ? chg(c) : c.color || C.ink,
            },
          };
        }),
      ),
    );
    const rh = Math.min(0.46, 4.6 / rows.length);
    s.addTable(rows, {
      x: X,
      y: 1.9,
      w: W,
      colW: sl.colW,
      fontFace: FONT,
      fontSize: rows.length > 10 ? 12 : 13,
      color: C.ink,
      rowH: rh,
      border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
      valign: 'middle',
      margin: [0, 0.08, 0, 0.08],
    });
  },
  method(sl) {
    const s = frame(sl);
    const h = Math.min(0.95, 4.9 / sl.items.length);
    sl.items.forEach(([k, v], i) => {
      txt(s, k, { x: X, y: 1.5 + i * h, w: 2.2, h: h - 0.1, fontSize: 13, bold: true, valign: 'top' });
      txt(s, v, { x: X + 2.4, y: 1.5 + i * h, w: 9.7, h: h - 0.1, fontSize: 13, valign: 'top', fit: 'shrink' });
    });
  },
};
D.slides.forEach((sl) => R[sl.type](sl));
pres.writeFile({ fileName: outPath }).then((f) => console.log('wrote', f));
