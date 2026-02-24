import PptxGenJS from 'pptxgenjs';
import { ExportConfig, AnalysisExportItem } from './types';
import { ProcessedRow, ProcessedColumn, ProcessedCell } from '../../types/processedData';

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
  const parts: string[] = [];
  if (showPercents) parts.push(`${cell.percent.toFixed(1)}%`);
  if (showCounts) parts.push(`(${cell.count})`);
  const text = parts.join(' ');
  if (!text) return '';
  const sig = showSig && cell.sig ? ` ${SIG_LETTERS[cell.sig] || ''}` : '';
  return `${text}${sig}`;
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

  // Header row — "Base" replaces "Total" to make clear the last column is always the base n
  const headerRow: PptxGenJS.TableCell[] = [
    { text: '', options: headerStyle },
    ...columns.map(col => ({ text: col.label, options: headerStyle })),
    { text: 'Base', options: headerStyle },
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
      // Base column always shows the respondent count (standard survey research convention)
      { text: String(row.total), options: { ...cellStyle, align: 'right' as const, bold: true } },
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
    y: 1.0,
    w: 12.3,
    h: 5.5,
    showTitle: false,
    showLegend: item.result.series.length > 1,
    legendPos: 'b',
    chartColors: [branding.headerColor, branding.primaryColor, '4F46E5', '10B981', 'F59E0B'],
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

export async function exportPptx(config: ExportConfig): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  const branding = {
    ...DEFAULTS,
    ...(config.branding?.primaryColor && { primaryColor: config.branding.primaryColor.replace('#', '') }),
    ...(config.branding?.headerColor && { headerColor: config.branding.headerColor.replace('#', '') }),
    ...(config.branding?.fontFamily && { fontFamily: config.branding.fontFamily }),
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
  for (const item of config.analyses) {
    const slide = pptx.addSlide();

    slide.addText(item.label, {
      x: 0.5,
      y: 0.3,
      w: '90%',
      fontSize: 18,
      fontFace: branding.fontFamily,
      color: branding.primaryColor,
      bold: true,
    });

    if (item.viewType === 'chart') {
      buildSlideChart(pptx, slide, item, branding);
    } else {
      const tableRows = buildSlideTable(item, item.result.columns, branding);
      // label column gets a fixed width; remaining width split among data cols + Base col
      const dataColCount = item.result.columns.length + 1; // data cols + Base
      const dataColWidth = (SLIDE_TABLE_WIDTH - LABEL_COL_WIDTH) / dataColCount;
      const colW = [LABEL_COL_WIDTH, ...Array(dataColCount).fill(dataColWidth)];

      slide.addTable(tableRows, {
        x: 0.5,
        y: 1.0,
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
