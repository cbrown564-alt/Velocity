/**
 * Sparkline Component
 *
 * A lightweight SVG component that renders visualization for variable distributions.
 * Supports:
 * - Bar charts for Nominal/Ordinal/Text (discrete values)
 * - Histograms for Scale/Date (continuous values)
 * - Visual missingness indicators
 */

import React from 'react';
import type { HistogramBin } from '../../types';
import { isCategoricalType, isOrderedType, normalizeVariableType } from '../../types';

export interface SparklineProps {
    /** Type determines the visualization style */
    type?: 'categorical' | 'ordered' | 'numeric' | 'text' | 'date' | 'nominal' | 'ordinal' | 'scale';
    /** Array of frequency counts (for categorical) */
    frequencies?: number[];
    /** Array of histogram bins (for numeric/scale) */
    histogramBins?: HistogramBin[];
    /** Top category info (for nominal leaderboard) */
    topCategory?: { label: string; percent: number; count: number };
    /** SVG width in pixels */
    width?: number;
    /** SVG height in pixels */
    height?: number;
    /** Maximum number of bars to show (for categorical) */
    maxBars?: number;
    /** CSS class for the container */
    className?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
    type = 'categorical',
    frequencies = [],
    histogramBins = [],
    topCategory,
    width = 60,
    height = 16,
    maxBars = 5,
    className,
}) => {
    // 1. SCALAR / DATE VISUALIZATION (Histogram)
    const normalizedType = normalizeVariableType(type);

    if (normalizedType === 'numeric' || normalizedType === 'date') {
        if (!histogramBins || histogramBins.length === 0) return null;

        // Determine Y scale
        const maxCount = Math.max(...histogramBins.map(b => b.count), 1);

        // Determine X scale
        const binWidth = width / histogramBins.length;

        return (
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                className={className}
                style={{ flexShrink: 0 }}
                role="img"
                aria-label="Distribution histogram"
            >
                {histogramBins.map((bin, index) => {
                    const barHeight = Math.max(2, (bin.count / maxCount) * height);
                    const x = index * binWidth;
                    const y = height - barHeight;

                    return (
                        <rect
                            key={index}
                            x={x}
                            y={y}
                            width={binWidth + 0.5} // Slight overlap to close gaps
                            height={barHeight}
                            fill="var(--color-accent)"
                            opacity={0.8}
                        />
                    );
                })}
            </svg>
        );
    }

    // 2. NOMINAL / TEXT VISUALIZATION (Leaderboard)
    // Show the most frequent category and its percentage
    if ((isCategoricalType(normalizedType) || normalizedType === 'text') && topCategory) {
        return (
            <div
                className={className}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    height,
                    maxWidth: '120px', // Limit width to prevent overcrowding
                }}
                title={`${topCategory.label} (${topCategory.percent.toFixed(1)}%)`}
            >
                <div style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    color: 'var(--color-ink)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '80px',
                }}>
                    {topCategory.label}
                </div>
                <div style={{
                    fontSize: '9px',
                    color: 'var(--gray-500)',
                    backgroundColor: 'var(--gray-100)',
                    padding: '0 4px',
                    borderRadius: '3px',
                    flexShrink: 0,
                }}>
                    {topCategory.percent.toFixed(0)}%
                </div>
            </div>
        );
    }

    // 3. ORDINAL VISUALIZATION (Distribution Strip)
    // 100% Stacked Bar to show skew/balance
    if (isOrderedType(normalizedType)) {
        const data = frequencies.slice(0, maxBars);
        if (data.length === 0) return null;

        // Ordinal data assumes the frequencies are already in order (e.g. Disagree -> Agree)
        // We render a single bar divided into segments
        const total = data.reduce((sum, val) => sum + val, 0);
        if (total === 0) return null;

        let currentX = 0;

        return (
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                className={className}
                style={{ flexShrink: 0 }}
                role="img"
                aria-label="Distribution strip"
            >
                <mask id="strip-mask">
                    <rect x="0" y="2" width={width} height={height - 4} rx="3" fill="white" />
                </mask>

                <g mask="url(#strip-mask)">
                    {data.map((value, index) => {
                        const segmentWidth = (value / total) * width;
                        const x = currentX;
                        currentX += segmentWidth;

                        // Vary opacity to differentiate segments visually without complex color scales
                        // Use a sine wave pattern for opacity to distinct even adjacent items
                        const opacity = 0.4 + (index / (data.length - 1)) * 0.6;

                        return (
                            <rect
                                key={index}
                                x={x}
                                y={0}
                                width={segmentWidth + 0.5} // Overlap to prevent sub-pixel gaps
                                height={height}
                                fill="var(--color-accent)"
                                opacity={opacity}
                            />
                        );
                    })}
                </g>
            </svg>
        );
    }

    // Default Fallback (should be covered by above, but safe to keep basic bars just in case)
    return null;
};

/**
 * Missingness Badge Component
 *
 * Shows a visual indicator when a variable has significant missing data.
 * Replaces simple text with a visual cue (dot/icon) for better scanning.
 */
interface MissingnessBadgeProps {
    /** Percentage of missing values (0-100) */
    missingPercent: number;
    /** Show only if above this threshold */
    threshold?: number;
    /** CSS class for the container */
    className?: string;
}

export const MissingnessBadge: React.FC<MissingnessBadgeProps> = ({
    missingPercent,
    threshold = 1, // Show even small amounts of missing data as a dot
    className,
}) => {
    if (missingPercent < threshold) {
        return null;
    }

    // Severity levels
    const isCritical = missingPercent >= 20; // Red
    const isModerate = missingPercent >= 5;  // Orange

    const color = isCritical
        ? 'var(--status-error-text)'
        : isModerate
            ? 'var(--status-warning-text)'
            : 'var(--text-secondary)';

    return (
        <div
            className={className}
            title={`${missingPercent.toFixed(1)}% missing values`}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '9px',
                fontWeight: 600,
                color: 'var(--gray-600)'
            }}
        >
            <div
                style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: color,
                }}
            />
            {isModerate && (
                <span>{missingPercent.toFixed(0)}%</span>
            )}
        </div>
    );
};
