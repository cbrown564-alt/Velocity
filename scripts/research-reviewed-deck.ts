/** Bounded SBT-002 prototype: reviewed evidence -> Velocity's native PPTX exporter.
 * This is an offline adapter, not a workspace/session format or an engine API.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import JSZip from 'jszip';
import { exportPptx } from '../src/core/export/pptxExporter';
import type { ExportConfig, AnalysisExportItem } from '../src/core/export/types';
import type { ChartSeries } from '../src/types/processedData';

type RecordValue = Record<string, unknown>;
const record = (v: unknown): RecordValue => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Expected an object');
  return v as RecordValue;
};
const array = (v: unknown): unknown[] => {
  if (!Array.isArray(v)) throw new Error('Expected an array');
  return v;
};
const text = (v: unknown): string => {
  if (typeof v !== 'string' || !v.trim()) throw new Error('Expected nonempty text');
  return v;
};
const numeric = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('Expected a finite number');
  return v;
};
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

function lookup(root: unknown, path: string): unknown {
  let value = root;
  for (const key of path
    .replace(/^analysis_results\.json\./, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    value = (value as RecordValue)[key];
  }
  return value;
}

const labels: Record<string, string> = {
  appeal_5: 'Overall appeal',
  purchase_intent_5: 'Purchase intent',
  uniqueness_5: 'Uniqueness',
  relevance_5: 'Relevance',
  credibility_5: 'Credibility',
  value_5: 'Expected value',
  understanding_5: 'Ease of understanding',
  premium_value_5: 'Premium conviction',
};
const concepts = ['Flex', 'Plus', 'Simple'];

export function buildReviewedExport(input: unknown, data: unknown): ExportConfig {
  const review = record(input),
    analysis = record(data);
  if (review.kind !== 'reviewed_research_prototype' || review.schema_version !== 1 || review.study_id !== 'SBT-002') {
    throw new Error('This prototype supports version 1 SBT-002 review artifacts only');
  }
  if (
    record(review.review).approved !== true ||
    record(review.preparation_review).prepared !== true ||
    !review.approved_at
  ) {
    throw new Error('Narrative and preparation must be approved');
  }
  if (review.source_sha256 !== analysis.source_sha256 || review.analysis_sha256 !== digest(analysis)) {
    throw new Error('Evidence changed: review the current numbers and approve the narrative again');
  }
  const findings = array(review.findings).map(record);
  const byId = new Map(findings.map((f) => [text(f.model_finding_id), f]));
  if (byId.size !== findings.length) throw new Error('Duplicate finding IDs');
  for (const finding of findings) {
    if (!['accept', 'revise'].includes(text(record(finding.review).decision))) throw new Error('Unapproved finding');
  }
  const beats = array(record(review.story).beats)
    .map(record)
    .sort((a, b) => numeric(a.order) - numeric(b.order));
  if (!beats.length) throw new Error('Empty narrative');
  const positions = beats.map((b) => numeric(b.order));
  if (new Set(positions).size !== positions.length || positions.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error('Invalid or duplicate story positions');
  const analyses: AnalysisExportItem[] = beats.map((beat) => {
    const selected = array(beat.finding_refs).map((id) => {
      const finding = byId.get(text(id));
      if (!finding) throw new Error('Narrative uses an unapproved finding');
      return finding;
    });
    const paths = [...new Set(selected.flatMap((f) => array(f.evidence_refs).map(text)))];
    for (const path of paths) if (lookup(analysis, path) === undefined) throw new Error(`Unresolved evidence: ${path}`);
    // One representative chart per approved beat; every cited result and revision
    // remains in notes. Full ordinal distributions take precedence over top-two.
    const chosen = paths.find((p) => {
      const value = lookup(analysis, p);
      return (
        value &&
        typeof value === 'object' &&
        concepts.every((c) => {
          const cell = (value as RecordValue)[c];
          return cell && typeof cell === 'object' && typeof (cell as RecordValue).top2_pct === 'number';
        })
      );
    });
    if (!chosen)
      throw new Error('No chartable approved concept table for this beat; this adapter requires analysis table paths');
    const cells = record(lookup(analysis, chosen));
    const variable = chosen.split('.').at(-1)!;
    const distribution = concepts.every((c) => record(cells[c]).distribution_pct !== undefined);
    const series: ChartSeries[] = (distribution ? ['1', '2', '3', '4', '5'] : ['top2']).map((code) => ({
      key: code,
      label: distribution ? `Score ${code}` : 'Scores 4–5',
      data: concepts.map((concept) => {
        const cell = record(cells[concept]);
        const percent = numeric(distribution ? record(cell.distribution_pct)[code] : cell.top2_pct);
        if (percent < 0 || percent > 100) throw new Error('Invalid percentage');
        return {
          label: concept,
          rawValue: concept,
          code: concept,
          percent,
          value: (percent * numeric(cell.n_weighted)) / 100,
        };
      }),
    }));
    const universe =
      variable === 'premium_value_5'
        ? 'Understanding score ≥3 only'
        : chosen.includes('non_explorer')
          ? 'Non-explorers'
          : chosen.includes('food_explorer')
            ? 'Food explorers'
            : 'All assigned respondents';
    return {
      label: text(beat.headline_intent),
      subtitle: `${labels[variable] || variable} · ${universe} · wt_final · valid n: ${concepts.map((c) => `${c} ${numeric(record(cells[c]).n_unweighted)}`).join(', ')}`,
      notes: JSON.stringify(
        {
          study_id: review.study_id,
          source_sha256: review.source_sha256,
          analysis_sha256: review.analysis_sha256,
          approved_at: review.approved_at,
          chart_table: chosen,
          findings: selected,
          cited_tables: paths.map((p) => ({ analysis_id: p, values: lookup(analysis, p) })),
        },
        null,
        2,
      ),
      viewType: 'chart',
      chartType: distribution ? 'stacked-bar' : 'horizontal-bar',
      options: { showPercents: true, showCounts: false, showSignificance: false },
      result: {
        rows: [],
        series,
        columns: [],
        grandTotal: 0,
        isMetric: false,
        isGrid: false,
        rowVariables: [],
        colVariable: null,
        isMultipleResponse: false,
      },
    };
  });
  return {
    title: 'SBT-002 · Reviewed research prototype',
    analyses,
    branding: {
      primaryColor: '24302A',
      headerColor: '6F8177',
      fontFamily: 'Arial',
      chartColors: ['F0F3F1', 'DCE6E0', 'C5D8CC', 'ACCAB8', '91B9A0'],
    },
  };
}

export async function exportReviewedDeck(review: unknown, analysis: unknown): Promise<Uint8Array> {
  const config = buildReviewedExport(review, analysis);
  const zip = await JSZip.loadAsync(await exportPptx(config));
  // Presentation-only correction for this adapter. Keep every native chart value;
  // omit labels that cannot fit in small segments and use a true 0–100% axis.
  for (const [name, file] of Object.entries(zip.files)) {
    if (!/^ppt\/charts\/chart\d+\.xml$/.test(name)) continue;
    let xml = await file.async('string');
    if (!xml.includes('<c:grouping val="stacked"/>')) continue;
    xml = xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (series) => {
      const values = series.match(/<c:val>([\s\S]*?)<\/c:val>/)?.[1] || '';
      const hidden = [...values.matchAll(/<c:pt idx="(\d+)"><c:v>([^<]+)<\/c:v><\/c:pt>/g)]
        .filter(([, , value]) => Number(value) < 5)
        .map(([, index]) => `<c:dLbl><c:idx val="${index}"/><c:delete val="1"/></c:dLbl>`)
        .join('');
      return series.replace('<c:dLbls>', '<c:dLbls>' + hidden);
    });
    xml = xml.replace(/<c:valAx>([\s\S]*?)<\/c:valAx>/g, (axis) =>
      axis.replace('</c:scaling>', '<c:max val="100"/><c:min val="0"/></c:scaling>'),
    );
    zip.file(name, xml);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [reviewPath, analysisPath, out] = process.argv.slice(2);
  if (!reviewPath || !analysisPath || !out)
    throw new Error(
      'Usage: tsx scripts/research-reviewed-deck.ts approved-review.json analysis_results.json output.pptx',
    );
  const review: unknown = JSON.parse(await readFile(reviewPath, 'utf8'));
  const analysis: unknown = JSON.parse(await readFile(analysisPath, 'utf8'));
  await writeFile(out, await exportReviewedDeck(review, analysis));
}
