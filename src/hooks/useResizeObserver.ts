import { useEffect, useState, RefObject } from 'react';

interface Dimensions {
    width: number;
    height: number;
}

export const useResizeObserver = (ref: RefObject<HTMLElement | null>): Dimensions => {
    const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });

    useEffect(() => {
        if (!ref.current) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
            }
        });

        observer.observe(ref.current);

        return () => {
            observer.disconnect();
        };
    }, [ref]);

    return dimensions;
};
