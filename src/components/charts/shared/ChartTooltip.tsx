import React from 'react';
import { createPortal } from 'react-dom';

interface ChartTooltipProps {
    x: number;
    y: number;
    visible: boolean;
    content: React.ReactNode;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({ x, y, visible, content }) => {
    if (!visible || !content) return null;

    // Use portal to break out of chart container overflow
    return createPortal(
        <div
            className="fixed z-50 pointer-events-none transition-opacity duration-150 ease-in-out"
            style={{
                left: x,
                top: y,
                transform: 'translate(-50%, -100%) translateY(-8px)', // Center above cursor/point with offset
            }}
        >
            <div className="bg-stone-900/90 text-white text-xs px-3 py-2 rounded shadow-lg backdrop-blur-sm border border-white/10 max-w-xs">
                {content}
            </div>
            {/* Tiny arrow pointing down */}
            <div
                className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-stone-900/90 absolute left-1/2 -bottom-[6px] -translate-x-1/2"
            />
        </div>,
        document.body
    );
};
