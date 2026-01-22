/**
 * Sparkline Component
 *
 * A lightweight SVG component that renders a horizontal bar chart
 * showing distribution frequencies. Used in Variable Manager cards.
 */

import React from 'react';

interface SparklineProps {
    /** Array of frequency counts (higher = larger bar) */
    frequencies: number[];
    /** SVG width in pixels */
    width?: number;
    /** SVG height in pixels */
    height?: number;
    /** Maximum number of bars to show */
    maxBars?: number;
    /** CSS class for the container */
    className?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
    frequencies,
    width = 60,
    height = 16,
    maxBars = 5,
    className,
}) => {
    // Take only the first N frequencies
    const data = frequencies.slice(0, maxBars);

    if (data.length === 0) {
        return null;
    }

    // Calculate the maximum value for scaling
    const maxValue = Math.max(...data, 1);

    // Bar configuration
    const barGap = 2;
    const availableWidth = width - (data.length - 1) * barGap;
    const barWidth = Math.max(4, Math.floor(availableWidth / data.length));
    const actualWidth = data.length * barWidth + (data.length - 1) * barGap;

    return (
        <svg
            width={actualWidth}
            height={height}
            viewBox={`0 0 ${actualWidth} ${height}`}
            className={className}
            style={{ flexShrink: 0 }}
            role="img"
            aria-label="Distribution sparkline"
        >
            {data.map((value, index) => {
                const barHeight = Math.max(2, (value / maxValue) * height);
                const x = index * (barWidth + barGap);
                const y = height - barHeight;

                return (
                    <rect
                        key={index}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        fill="var(--color-terracotta)"
                        opacity={0.7 + (value / maxValue) * 0.3}
                        rx={1}
                    />
                );
            })}
        </svg>
    );
};

/**
 * Missingness Badge Component
 *
 * Shows a small indicator when a variable has significant missing data.
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
    threshold = 5,
    className,
}) => {
    // Don't show if below threshold
    if (missingPercent < threshold) {
        return null;
    }

    // Determine severity level
    const isHigh = missingPercent >= 20;

    return (
        <span
            className={className}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '1px 4px',
                borderRadius: '3px',
                backgroundColor: isHigh ? 'var(--color-warning)' : 'var(--gray-200)',
                color: isHigh ? 'white' : 'var(--gray-600)',
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '0.02em',
            }}
            title={`${missingPercent.toFixed(1)}% missing values`}
        >
            {missingPercent.toFixed(0)}%
        </span>
    );
};
