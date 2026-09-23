/** Offline new-study adapter: approved research -> existing native PPTX exporter.
 * Review artifacts remain experimental and are not Velocity session files.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import JSZip from 'jszip';
import { exportPptx } from '../src/core/export/pptxExporter';
import type { AnalysisExportItem, ExportConfig } from '../src/core/export/types';

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as ObjectValue;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected array');
  return value;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Expected text');
  return value;
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Expected finite number');
  return value;
}
function pathParts(path: string): string[] {
  if (path.startsWith('analysis_results.json#/'))
    return path
      .split('#/')[1]
      .split('/')
      .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  return path
    .replace(/^analysis_results\.json\./, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.');
}
function lookup(root: unknown, path: string): unknown {
  let value = root;
  for (const key of pathParts(path)) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    value = (value as ObjectValue)[key];
  }
  return value;
}

export function buildExpansionExport(input: unknown, data: unknown): ExportConfig {
  const review = object(input),
    analysis = object(data);
  if (
    review.kind !== 'reviewed_research_prototype' ||
    review.schema_version !== 1 ||
    !['SBT-004', 'SBT-005', 'SBT-006'].includes(text(review.study_id)) ||
    review.study_id !== (analysis.study_id || analysis.project_id)
  )
    throw new Error('Unsupported or inconsistent study');
  if (
    object(review.preparation_review).prepared !== true ||
    object(review.review).approved !== true ||
    !review.approved_at
  )
    throw new Error('Preparation and narrative must be approved');
  const hash = createHash('sha256').update(JSON.stringify(analysis)).digest('hex');
  if (review.source_sha256 !== analysis.source_sha256 || review.analysis_sha256 !== hash)
    throw new Error('Evidence changed: inspect current numbers and approve the narrative again');
  const findings = array(review.findings).map(object);
  const byId = new Map(findings.map((f) => [text(f.model_finding_id), f]));
  if (!findings.length || byId.size !== findings.length) throw new Error('Empty or duplicate findings');
  for (const f of findings)
    if (!['accept', 'revise'].includes(text(object(f.review).decision))) throw new Error('Unapproved finding');
  const beats = array(object(review.story).beats)
    .map(object)
    .sort((a, b) => number(a.order) - number(b.order));
  const positions = beats.map((b) => number(b.order));
  if (
    !beats.length ||
    new Set(positions).size !== positions.length ||
    positions.some((n) => !Number.isInteger(n) || n < 1)
  )
    throw new Error('Invalid story positions');
  const analyses: AnalysisExportItem[] = beats.map((beat) => {
    const selected = array(beat.finding_refs).map((id) => {
      const f = byId.get(text(id));
      if (!f) throw new Error('Story references an unapproved finding');
      return f;
    });
    if (!selected.length) throw new Error('Empty story finding references');
    const paths = [...new Set(selected.flatMap((f) => array(f.evidence_refs).map(text)))];
    if (!paths.length) throw new Error('Unresolved evidence: no references');
    for (const path of paths) if (lookup(analysis, path) === undefined) throw new Error('Unresolved evidence: ' + path);
    const tablePaths = [
      ...new Set(
        paths
          .map(
            (p) =>
              pathParts(p)
                .slice(0, 2)
                .join('.')
                .match(/^tables\.[^.]+/)?.[0],
          )
          .filter((p): p is string => !!p),
      ),
    ];
    const chosen = tablePaths.find((p) => {
      const t = object(lookup(analysis, p));
      return t.chart && object(t.values).status !== 'suppressed';
    });
    if (!chosen) throw new Error('No chartable approved table; select a supported table before exporting');
    const table = object(lookup(analysis, chosen)),
      chart = object(table.chart);
    let labels = array(chart.labels).map(text);
    if (review.study_id === 'SBT-006' && chosen === 'tables.audience_intent')
      labels = labels.map((label) => label.replace(/^(£\d+): audience$/, '$1: family'));
    const groupLabels: Record<string, string[]> = {
      children_u16: ['Households with children under 16', 'Households without children under 16'],
      need_effort: ['Meets effort criteria', 'Does not meet effort criteria'],
      need_budget: ['Meets budget criteria', 'Does not meet budget criteria'],
      need_waste: ['Meets waste criteria', 'Does not meet waste criteria'],
    };
    const group = Array.isArray(table.source_variables) ? String(table.source_variables[1]) : '';
    if (labels.join('|') === 'Criteria met / group 1|Criteria not met / group 0' && groupLabels[group])
      labels = groupLabels[group];
    const values = array(chart.values).map(number);
    const unit = text(chart.unit),
      percents = unit === 'percent';
    if (!labels.length || labels.length !== values.length || (percents && values.some((v) => v < 0 || v > 100 + 1e-9)))
      throw new Error('Chart categories or values are invalid');
    const bases = array(chart.bases).map(number);
    const qualifier = selected
      .map((f) => (typeof f.qualification === 'string' ? f.qualification : ''))
      .filter(Boolean)
      .join(' ');
    return {
      label: text(beat.headline_intent),
      subtitle: `${text(table.title)} · ${({ percentage_points: 'percentage points', GBP_proxy: 'GBP per hypothetical household-month' } as Record<string, string>)[unit] || unit} · valid n: ${bases.join(', ') || 'see evidence'} · ${text(table.weighting)}`,
      notes: JSON.stringify(
        {
          study_id: review.study_id,
          source_sha256: review.source_sha256,
          analysis_sha256: review.analysis_sha256,
          approved_at: review.approved_at,
          universe: table.universe,
          review_record: review.review,
          preparation_review: review.preparation_review,
          qualifications: qualifier,
          chart_table: chosen,
          original_beat: beat,
          findings: selected,
          cited_tables: paths.map((p) => ({ analysis_id: p, values: lookup(analysis, p) })),
        },
        null,
        2,
      ),
      viewType: 'chart',
      chartType: 'horizontal-bar',
      options: { showPercents: percents, showCounts: !percents, showSignificance: false },
      result: {
        rows: [],
        columns: [],
        grandTotal: 0,
        isMetric: !percents,
        isGrid: false,
        rowVariables: [],
        colVariable: null,
        isMultipleResponse: false,
        series: [
          {
            key: 'approved',
            label: unit,
            data: labels.map((label, i) => ({
              label,
              rawValue: label,
              code: String(i),
              value: values[i],
              percent: percents ? values[i] : 0,
            })),
          },
        ],
      },
    };
  });
  return {
    title: `${text(review.study_id)} · Research export prototype`,
    analyses,
    branding: { primaryColor: '24302A', headerColor: '6F8177', fontFamily: 'Arial', chartColors: ['6F9680'] },
  };
}

export async function exportExpansionDeck(review: unknown, analysis: unknown): Promise<Uint8Array> {
  const config = buildExpansionExport(review, analysis);
  const zip = await JSZip.loadAsync(await exportPptx(config));
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/chart(\d+)/)![1]) - Number(b.match(/chart(\d+)/)![1]));
  if (names.length !== config.analyses.length) throw new Error('Unexpected native chart count');
  for (const [i, name] of names.entries()) {
    const item = config.analyses[i],
      percent = item.options?.showPercents === true;
    const values = item.result.series.flatMap((s) => s.data.map((d) => (percent ? d.percent : d.value)));
    let xml = await zip.file(name)!.async('string');
    // All adapter categories are flat. LibreOffice drops short labels from the
    // exporter's multi-level cache; retain native editable single-level strings.
    xml = xml.replace(/<c:cat>[\s\S]*?<\/c:cat>/g, (category) =>
      category
        .replace(/multiLvlStrRef/g, 'strRef')
        .replace(/multiLvlStrCache/g, 'strCache')
        .replace(/<\/?c:lvl>/g, ''),
    );
    // Bound this prototype's axes explicitly: automatic truncation exaggerates
    // closely grouped barriers. All positive metric bars also start at zero.
    xml = xml.replace(/<c:valAx>[\s\S]*?<\/c:valAx>/g, (axis) =>
      axis
        .replace(/<c:(min|max) val="[^"]*"\/>/g, '')
        .replace(
          '</c:scaling>',
          `<c:min val="${Math.min(0, ...values)}"/>${percent ? '<c:max val="100"/>' : Math.max(...values) <= 0 ? '<c:max val="0"/>' : ''}</c:scaling>`,
        ),
    );
    if (!percent) xml = xml.replace(/formatCode="0"/g, 'formatCode="0.0"');
    zip.file(name, xml);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [reviewPath, analysisPath, out] = process.argv.slice(2);
  if (!reviewPath || !analysisPath || !out)
    throw new Error('Usage: tsx scripts/research-expansion-deck.ts approved.json analysis.json output.pptx');
  await writeFile(
    out,
    await exportExpansionDeck(
      JSON.parse(await readFile(reviewPath, 'utf8')),
      JSON.parse(await readFile(analysisPath, 'utf8')),
    ),
  );
}
