import { useEffect, useRef, useState, RefObject } from 'react';

interface Dimensions {
  width: number;
  height: number;
}

export const useResizeObserver = (ref: RefObject<HTMLElement | null>): Dimensions => {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });
  const observedNodeRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (observedNodeRef.current === node) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    observedNodeRef.current = node;

    if (!node) return;

    const updateDimensions = (width: number, height: number) => {
      setDimensions((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };

    const rect = node.getBoundingClientRect();
    updateDimensions(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateDimensions(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(node);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      if (observerRef.current === observer) {
        observerRef.current = null;
      }
      if (observedNodeRef.current === node) {
        observedNodeRef.current = null;
      }
    };
  });

  return dimensions;
};
