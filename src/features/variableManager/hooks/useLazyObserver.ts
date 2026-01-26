import { useEffect } from 'react';

/**
 * Hook to set up an IntersectionObserver for lazy-loading data when items scroll into view.
 * 
 * @param containerRef - Ref to the scroll container (used as root)
 * @param itemRefs - Map of item IDs to DOM elements
 * @param onIntersect - Callback fired when an item intersects. Receives the ID.
 * @param dataAttribute - The data attribute on the element containing the ID (e.g. 'data-id')
 * @param dependencies - Array of dependencies that should trigger a re-setup (e.g. list data changing)
 */
export const useLazyObserver = (
    containerRef: React.RefObject<HTMLElement>,
    itemRefs: React.MutableRefObject<Map<string, HTMLElement>>,
    onIntersect: (id: string) => void,
    dataAttribute: string,
    dependencies: any[] = []
) => {
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const id = entry.target.getAttribute(dataAttribute);
                        if (id) {
                            onIntersect(id);
                        }
                    }
                });
            },
            {
                root: containerRef.current,
                rootMargin: '50px',
                threshold: 0.1,
            }
        );

        const currentRefs = itemRefs.current;
        currentRefs.forEach((element) => {
            if (element) observer.observe(element);
        });

        return () => {
            observer.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [containerRef, dataAttribute, onIntersect, ...dependencies]);
};
