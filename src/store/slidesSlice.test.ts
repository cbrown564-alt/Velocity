import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVelocityStore } from './index';

describe('slidesSlice', () => {
    beforeEach(() => {
        // Reset slides state to initial value with a single slide
        useVelocityStore.setState({
            slides: [{
                id: 'slide-test-1',
                title: 'Analysis 1',
                subtitle: '',
                analysisState: {
                    rowVars: [],
                    colVar: null,
                    filters: [],
                    weightVar: null,
                },
                visualizationType: 'table' as const,
                layoutMode: 'focus' as const,
                cells: [{ id: 'cell-test-1', content: { type: 'table' as const } }],
                createdAt: Date.now(),
                updatedAt: Date.now(),
            }],
            activeSlideId: 'slide-test-1',
            activeCellId: 'cell-test-1',
        });
    });

    describe('addSlide', () => {
        it('should snapshot the active slide before switching to a blank slide', () => {
            const { result } = renderHook(() => useVelocityStore());

            act(() => {
                result.current.setTableConfig({ rowVars: ['impact'], colVar: 'segment' });
                result.current.addSlide();
            });

            const originalSlide = result.current.slides[0];
            const newSlide = result.current.slides[1];

            expect(originalSlide.analysisState).toEqual({
                rowVars: ['impact'],
                colVar: 'segment',
                filters: [],
                weightVar: null,
            });
            expect(newSlide.analysisState).toEqual({
                rowVars: [],
                colVar: null,
                filters: [],
                weightVar: null,
            });
            expect(result.current.activeSlideId).toBe(newSlide.id);
        });
    });

    describe('duplicateSlide', () => {
        it('should create a copy with a new ID', () => {
            const { result } = renderHook(() => useVelocityStore());

            // Get the initial slide
            const initialSlide = result.current.slides[0];
            const initialSlideCount = result.current.slides.length;

            act(() => {
                result.current.duplicateSlide(initialSlide.id);
            });

            expect(result.current.slides.length).toBe(initialSlideCount + 1);
            // New slide should have a different ID
            const newSlide = result.current.slides.find(s => s.id !== initialSlide.id);
            expect(newSlide).toBeDefined();
            expect(newSlide!.id).not.toBe(initialSlide.id);
        });

        it('should append " (Copy)" to the title', () => {
            const { result } = renderHook(() => useVelocityStore());

            const initialSlide = result.current.slides[0];

            act(() => {
                result.current.duplicateSlide(initialSlide.id);
            });

            const duplicatedSlide = result.current.slides[1];
            expect(duplicatedSlide.title).toBe(`${initialSlide.title} (Copy)`);
        });

        it('should number repeated duplicates instead of chaining "(Copy) (Copy)"', () => {
            const { result } = renderHook(() => useVelocityStore());
            const initialSlide = result.current.slides[0];

            act(() => {
                result.current.duplicateSlide(initialSlide.id);
            });
            const firstCopy = result.current.slides.find((s) => s.title.endsWith('(Copy)'));
            expect(firstCopy).toBeDefined();

            act(() => {
                result.current.duplicateSlide(firstCopy!.id);
            });

            const secondCopy = result.current.slides.find((s) => s.title.endsWith('(Copy 2)'));
            expect(secondCopy?.title).toBe(`${initialSlide.title} (Copy 2)`);
        });

        it('should preserve analysisState', () => {
            const { result } = renderHook(() => useVelocityStore());

            // First update the slide's analysis state
            act(() => {
                const slideId = result.current.slides[0].id;
                // Set some table config that will be captured
                result.current.setTableConfig({ rowVars: ['var1', 'var2'], colVar: 'var3' });
                result.current.snapshotCurrentSlide();
            });

            const originalSlide = result.current.slides[0];

            act(() => {
                result.current.duplicateSlide(originalSlide.id);
            });

            const duplicatedSlide = result.current.slides[1];
            expect(duplicatedSlide.analysisState.rowVars).toEqual(originalSlide.analysisState.rowVars);
            expect(duplicatedSlide.analysisState.colVar).toBe(originalSlide.analysisState.colVar);
        });

        it('should insert after the original in array', () => {
            const { result } = renderHook(() => useVelocityStore());

            // Add a second slide
            act(() => {
                result.current.addSlide('Second Slide');
            });

            const firstSlideId = result.current.slides[0].id;

            act(() => {
                result.current.duplicateSlide(firstSlideId);
            });

            // The duplicate should be at index 1, not at the end
            expect(result.current.slides[1].title).toContain('(Copy)');
            expect(result.current.slides[2].title).toBe('Second Slide');
        });

        it('should activate the new duplicate', () => {
            const { result } = renderHook(() => useVelocityStore());

            const initialSlideId = result.current.slides[0].id;

            act(() => {
                result.current.duplicateSlide(initialSlideId);
            });

            const duplicatedSlide = result.current.slides.find(s => s.title.includes('(Copy)'));
            expect(result.current.activeSlideId).toBe(duplicatedSlide!.id);
        });
    });

    describe('removeSlide', () => {
        it('should prevent deletion of last slide', () => {
            const { result } = renderHook(() => useVelocityStore());

            // Should only have one slide initially
            expect(result.current.slides.length).toBe(1);
            const onlySlideId = result.current.slides[0].id;

            act(() => {
                result.current.removeSlide(onlySlideId);
            });

            // Should still have one slide
            expect(result.current.slides.length).toBe(1);
            expect(result.current.slides[0].id).toBe(onlySlideId);
        });

        it('should delete slide when more than one exists', () => {
            const { result } = renderHook(() => useVelocityStore());

            // Add a second slide
            act(() => {
                result.current.addSlide('Second Slide');
            });

            expect(result.current.slides.length).toBe(2);
            const firstSlideId = result.current.slides[0].id;

            act(() => {
                result.current.removeSlide(firstSlideId);
            });

            expect(result.current.slides.length).toBe(1);
            expect(result.current.slides[0].title).toBe('Second Slide');
        });

        it('should activate next slide when deleting active', () => {
            const { result } = renderHook(() => useVelocityStore());

            // Add second slide
            act(() => {
                result.current.addSlide('Second Slide');
            });

            expect(result.current.slides.length).toBe(2);

            // addSlide activates the new slide, so the second slide is active
            const secondSlide = result.current.slides[1];
            expect(result.current.activeSlideId).toBe(secondSlide.id);

            act(() => {
                result.current.removeSlide(secondSlide.id);
            });

            // Should activate remaining slide
            expect(result.current.slides.length).toBe(1);
            expect(result.current.activeSlideId).not.toBe(secondSlide.id);
            expect(result.current.activeSlideId).toBe(result.current.slides[0].id);
        });
    });
});
