/**
 * Charts Components
 *
 * Interactive visualization components built with D3.
 */

// Primary D3-based chart (recommended)
export { D3BarChart } from './D3BarChart';
export type {
    D3BarChartProps,
    BarDatum,
    SelectionEvent,
} from './D3BarChart';

// Legacy: Observable Plot based (kept for reference)
export { PlotWrapper } from './PlotWrapper';
export type { PlotWrapperProps } from './PlotWrapper';

export { InteractiveBarChart } from './InteractiveBarChart';
export type {
    InteractiveBarChartProps,
    BarClickEvent,
} from './InteractiveBarChart';

// Legacy: Mosaic based (deprecated - too slow for small data)
export { MosaicBarChart } from './MosaicBarChart';
export type {
    MosaicBarChartProps,
    MosaicBarDatum,
    MosaicSelectionEvent,
} from './MosaicBarChart';
