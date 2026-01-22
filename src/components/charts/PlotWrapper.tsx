/**
 * PlotWrapper Component
 *
 * Generic React wrapper for Observable Plot.
 * Handles mounting/unmounting and re-rendering when options change.
 */

import React, { useRef, useEffect } from 'react';
import * as Plot from '@observablehq/plot';

export interface PlotWrapperProps {
    /** Observable Plot options (marks, scales, etc.) */
    options: Plot.PlotOptions;
    /** Optional className for the container */
    className?: string;
    /** Optional inline styles */
    style?: React.CSSProperties;
    /** Callback when plot is rendered (provides SVG element) */
    onRender?: (svg: SVGSVGElement | HTMLElement) => void;
}

export const PlotWrapper: React.FC<PlotWrapperProps> = ({
    options,
    className,
    style,
    onRender,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Render the plot
        const plot = Plot.plot(options);

        // Clear and append
        containerRef.current.replaceChildren(plot);

        // Notify parent if callback provided
        if (onRender) {
            onRender(plot);
        }

        // Cleanup on unmount or re-render
        return () => {
            plot.remove();
        };
    }, [options, onRender]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={style}
        />
    );
};
