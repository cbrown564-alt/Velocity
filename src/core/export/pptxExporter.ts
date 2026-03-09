import PptxGenJS from 'pptxgenjs';
import { ExportConfig, AnalysisExportItem } from './types';
import { ProcessedRow, ProcessedColumn, ProcessedCell } from '../../types/processedData';
import type { SlideSection } from '../../types/slides';

const SIG_LETTERS: Record<string, string> = {
  high_95: '▲',
  high_80: '△',
  low_95: '▼',
  low_80: '▽',
};

const DEFAULTS = {
  primaryColor: '1C1C1C',
  headerColor: 'E07A5F',
  fontFamily: 'Atkinson Hyperlegible',
  fontSize: 9,
  headerFontSize: 10,
  chartColors: ['E07A5F', '1C1C1C', '4F46E5', '10B981', 'F59E0B'],
};

// Width (inches) reserved for the row-label column.
// Remaining space is split equally among data columns + Base column.
const LABEL_COL_WIDTH = 3.0;
const SLIDE_TABLE_WIDTH = 12.3;

function flattenRows(rows: ProcessedRow[], result: ProcessedRow[] = []): ProcessedRow[] {
  for (const row of rows) {
    result.push(row);
    if (row.children.length) {
      flattenRows(row.children, result);
    }
  }
  return result;
}

/**
 * Format a single data cell for PPTX output.
 * Exported for unit testing.
 */
export function formatCell(
  cell: ProcessedCell | undefined,
  showSig: boolean,
  showPercents: boolean,
  showCounts: boolean,
): string {
  if (!cell) return '';
  // Significance markers are only meaningful on proportions, not raw counts
  const sig = showSig && showPercents && cell.sig ? ` ${SIG_LETTERS[cell.sig] || ''}` : '';
  if (showCounts && showPercents) {
    // count (percent sig) — count-first for readability in combined mode
    return `${cell.count} (${cell.percent.toFixed(1)}%${sig})`;
  }
  if (showPercents) {
    return `${cell.percent.toFixed(1)}%${sig}`;
  }
  if (showCounts) {
    return `${cell.count}`;
  }
  return '';
}

function buildSlideTable(
  item: AnalysisExportItem,
  columns: ProcessedColumn[],
  branding: typeof DEFAULTS,
): PptxGenJS.TableRow[] {
  const showSig = item.options?.showSignificance !== false;
  const showPercents = item.options?.showPercents !== false;
  const showCounts = item.options?.showCounts === true;

  const headerStyle: PptxGenJS.TableCellProps = {
    fill: { color: branding.headerColor },
    color: 'FFFFFF',
    bold: true,
    fontSize: branding.headerFontSize,
    fontFace: branding.fontFamily,
    border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
    valign: 'middle',
  };

  const cellStyle: PptxGenJS.TableCellProps = {
    fontSize: branding.fontSize,
    fontFace: branding.fontFamily,
    border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
    valign: 'middle',
  };

  const tableRows: PptxGenJS.TableRow[] = [];

  // Header row — "Total" column only shown when showCounts is enabled
  const headerRow: PptxGenJS.TableCell[] = [
    { text: '', options: headerStyle },
    ...columns.map(col => ({ text: col.label, options: headerStyle })),
    ...(showCounts ? [{ text: 'Total', options: headerStyle }] : []),
  ];
  tableRows.push(headerRow);

  // Data rows
  const flatRows = flattenRows(item.result.rows);
  for (const row of flatRows) {
    const indent = row.depth > 0 ? '  '.repeat(row.depth) : '';
    const labelStyle: PptxGenJS.TableCellProps = {
      ...cellStyle,
      bold: row.depth === 0,
    };

    const dataRow: PptxGenJS.TableCell[] = [
      { text: `${indent}${row.label}`, options: labelStyle },
      ...columns.map(col => ({
        text: formatCell(row.cells[col.key], showSig, showPercents, showCounts),
        options: { ...cellStyle, align: 'right' as const },
      })),
      ...(showCounts ? [{ text: String(row.total), options: { ...cellStyle, align: 'right' as const, bold: true } }] : []),
    ];
    tableRows.push(dataRow);
  }

  return tableRows;
}

function buildSlideChart(
  pptx: PptxGenJS,
  slide: ReturnType<PptxGenJS['addSlide']>,
  item: AnalysisExportItem,
  branding: typeof DEFAULTS,
  contentY: number,
) {
  // Guard: PptxGenJS crashes on empty series data (data[0].labels is undefined).
  // Fall back to an empty slide when there's nothing to chart.
  if (!item.result.series.length) return;

  const chartTypeKey = item.chartType || 'vertical-bar';
  const showPercents = item.options?.showPercents !== false;
  const showCounts = item.options?.showCounts === true;

  // Mapping Velocity ChartType to PPTX chart types.
  // PptxGenJS.ChartType is an instance property, so we use string literals directly.
  // Exotic types that have no direct PPTX equivalent fall back to clustered column.
  let pptxChartType: PptxGenJS.CHART_NAME = 'bar';
  let barDir: 'bar' | 'col' = 'col';
  let barGrouping: 'clustered' | 'stacked' | 'percentStacked' = 'clustered';
  let isBarChart = true;

  switch (chartTypeKey) {
    case 'horizontal-bar':
    case 'diverging-bar':
      barDir = 'bar';
      barGrouping = 'clustered';
      break;
    case 'vertical-bar':
    case 'lollipop': // no native lollipop in PPTX; render as clustered column
      barDir = 'col';
      barGrouping = 'clustered';
      break;
    case 'grouped-bar':
      barDir = 'bar';
      barGrouping = 'clustered';
      break;
    case 'grouped-column':
      barDir = 'col';
      barGrouping = 'clustered';
      break;
    case 'stacked-bar':
      barDir = 'bar';
      barGrouping = 'stacked';
      break;
    case 'donut':
      pptxChartType = 'doughnut';
      isBarChart = false;
      break;
    case 'scatter':
      pptxChartType = 'scatter';
      isBarChart = false;
      break;
    default:
      // histogram, box-plot, violin, ridgeline, hexbin, grouped-box-plot:
      // no native PPTX equivalent; fall back to clustered column
      barDir = 'col';
      barGrouping = 'clustered';
      break;
  }

  const baseChartOpts: any = {
    x: 0.5,
    y: contentY,
    w: 12.3,
    h: 6.0 - Math.max(0, contentY - 1.0),
    showTitle: false,
    showLegend: item.result.series.length > 1,
    legendPos: 'b',
    chartColors: branding.chartColors ?? [branding.headerColor, branding.primaryColor, '4F46E5', '10B981', 'F59E0B'],
    dataLabelFontFace: branding.fontFamily,
    dataLabelFontSize: 10,
    showValue: true,
  };

  // Bar-specific options must not be applied to donut or scatter
  if (isBarChart) {
    // Data label format: percent takes precedence, then raw count
    const labelFmt = showPercents ? '0.0"%"' : '0';
    const axisFmt = showPercents ? '0"%"' : '0';
    Object.assign(baseChartOpts, {
      barDir,
      barGrouping,
      dataLabelFormatCode: labelFmt,
      dataBorder: { pt: 1, color: 'FFFFFF' },
      dataLabelColor: '333333',
      valAxisLabelFormatCode: axisFmt,
      showValue: showPercents || showCounts,
    });
  }

  if (pptxChartType === 'scatter') {
    // PptxGenJS scatter requires { name, values: y[], xData: x[] }.
    // Our data model has no dedicated x-axis variable, so we use the
    // categorical index (1-based) as x and value/percent as y.
    const scatterData = item.result.series.map(series => ({
      name: series.label || 'Series 1',
      values: series.data.map(d => (showPercents ? d.percent : d.value)),
      xData: series.data.map((_, i) => i + 1),
    }));
    slide.addChart(pptxChartType, scatterData, baseChartOpts);
    return;
  }

  // Donut/doughnut is inherently single-series in PPTX. When the analysis
  // has multiple column-banner series we flatten all data points from the
  // first series into the ring. Using only the first series keeps the chart
  // readable and avoids garbled multi-ring output from PptxGenJS.
  const seriesToRender =
    pptxChartType === 'doughnut'
      ? item.result.series.slice(0, 1)
      : item.result.series;

  // Choose value source: percent when showing percentages, raw count otherwise
  const getValue = (d: { percent: number; value: number }) =>
    showPercents ? d.percent : d.value;

  const seriesData = seriesToRender.map(series => ({
    name: series.label || 'Series 1',
    labels: series.data.map(d => d.label),
    values: series.data.map(d => getValue(d)),
  }));

  slide.addChart(pptxChartType, seriesData, baseChartOpts);
}

function addSectionDividerSlide(
  pptx: PptxGenJS,
  section: SlideSection,
  branding: typeof DEFAULTS
) {
  const slide = pptx.addSlide();
  const accent = section.color ? normalizeColor(section.color) : branding.headerColor;

  slide.addText(section.title, {
    x: 0.6,
    y: 2.2,
    w: 11.8,
    h: 1.2,
    fontSize: 28,
    fontFace: branding.fontFamily,
    color: accent,
    bold: true,
    align: 'center',
    valign: 'middle',
  });

  slide.addText('Section Divider', {
    x: 0.6,
    y: 3.55,
    w: 11.8,
    fontSize: 11,
    fontFace: branding.fontFamily,
    color: branding.primaryColor,
    align: 'center',
  });
}

/** Convert any CSS color string to a bare 6-char hex string for PptxGenJS. */
function normalizeColor(color: string): string {
  const hex = color.trim();
  if (hex.startsWith('#')) return hex.slice(1);
  const rgba = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgba) {
    return [rgba[1], rgba[2], rgba[3]]
      .map(n => parseInt(n, 10).toString(16).padStart(2, '0'))
      .join('');
  }
  return hex;
}

export async function exportPptx(config: ExportConfig): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  const branding = {
    ...DEFAULTS,
    ...(config.branding?.primaryColor && { primaryColor: normalizeColor(config.branding.primaryColor) }),
    ...(config.branding?.headerColor && { headerColor: normalizeColor(config.branding.headerColor) }),
    ...(config.branding?.fontFamily && { fontFamily: config.branding.fontFamily }),
    ...(config.branding?.chartColors && { chartColors: config.branding.chartColors.map(normalizeColor) }),
  };

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.addText(config.title, {
    x: 0.5,
    y: '40%',
    w: '90%',
    fontSize: 28,
    fontFace: branding.fontFamily,
    color: branding.primaryColor,
    bold: true,
  });

  // One slide per analysis
  let lastSectionId: string | undefined;
  for (const item of config.analyses) {
    if (item.sectionId && item.sectionId !== lastSectionId) {
      const section = config.sections?.find((entry) => entry.id === item.sectionId);
      if (section) {
        addSectionDividerSlide(pptx, section, branding);
      }
    }
    lastSectionId = item.sectionId;

    const slide = pptx.addSlide();
    const contentY = item.subtitle ? 1.3 : 1.0;

    slide.addText(item.label, {
      x: 0.5,
      y: 0.3,
      w: '90%',
      fontSize: 18,
      fontFace: branding.fontFamily,
      color: branding.primaryColor,
      bold: true,
    });

    if (item.subtitle) {
      slide.addText(item.subtitle, {
        x: 0.5,
        y: 0.68,
        w: '90%',
        fontSize: 10,
        fontFace: branding.fontFamily,
        color: '666666',
      });
    }

    if (item.notes && typeof (slide as any).addNotes === 'function') {
      (slide as any).addNotes(item.notes);
    }

    if (item.viewType === 'chart' || item.visualizationType === 'chart') {
      buildSlideChart(pptx, slide, item, branding, contentY);
    } else {
      const showCounts = item.options?.showCounts === true;
      const tableRows = buildSlideTable(item, item.result.columns, branding);
      // label column gets a fixed width; remaining width split among data cols (+ Total col when showCounts)
      const dataColCount = item.result.columns.length + (showCounts ? 1 : 0);
      const dataColWidth = (SLIDE_TABLE_WIDTH - LABEL_COL_WIDTH) / dataColCount;
      const colW = [LABEL_COL_WIDTH, ...Array(dataColCount).fill(dataColWidth)];

      slide.addTable(tableRows, {
        x: 0.5,
        y: contentY,
        w: SLIDE_TABLE_WIDTH,
        colW,
        rowH: 0.35,
        autoPage: true,
        autoPageRepeatHeader: true,
      });
    }
  }

  const output = await pptx.write({ outputType: 'uint8array' });
  return output as Uint8Array;
}
