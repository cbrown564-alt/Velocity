/**
 * MosaicBarChart Component - SPIKE
 *
 * A bar chart built on Mosaic/vgplot with native brush selection.
 * This spike tests whether Mosaic provides the interaction model we need.
 *
 * Key differences from Observable Plot:
 * - Brush selection is built-in (drag to select)
 * - Cross-filtering is native
 * - DuckDB integration means selections are SQL WHERE clauses
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as vg from '@uwdata/vgplot';
import { coordinator, wasmConnector } from '@uwdata/mosaic-core';
import styles from './MosaicBarChart.module.css';

export interface MosaicBarDatum {
    label: string;
    value: number;
    code?: number | string;
}

export interface MosaicSelectionEvent {
    /** Selected values (labels) */
    selectedLabels: string[];
    /** Selected codes (for filtering) */
    selectedCodes: (number | string)[];
    /** Position for context menu */
    position: { x: number; y: number };
}

export interface MosaicBarChartProps {
    /** The data to display */
    data: MosaicBarDatum[];
    /** Chart width */
    width?: number;
    /** Chart height */
    height?: number;
    /** Orientation */
    orientation?: 'vertical' | 'horizontal';
    /** Color for bars */
    color?: string;
    /** Title for the chart */
    title?: string;
    /** Callback when selection changes (from brush) */
    onSelectionChange?: (selection: MosaicSelectionEvent | null) => void;
    /** Callback when right-clicking on selection */
    onSelectionContextMenu?: (event: MosaicSelectionEvent) => void;
    /** Optional className */
    className?: string;
}

// Track if coordinator is initialized
let coordinatorInitialized = false;
let initPromise: Promise<void> | null = null;

async function initCoordinator(): Promise<void> {
    if (coordinatorInitialized) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            const connector = wasmConnector({ log: false });
            coordinator().databaseConnector(connector);
            coordinatorInitialized = true;
            console.log('[Mosaic] Coordinator initialized');
        } catch (err) {
            console.error('[Mosaic] Failed to initialize coordinator:', err);
            throw err;
        }
    })();

    return initPromise;
}

export const MosaicBarChart: React.FC<MosaicBarChartProps> = ({
    data,
    width = 300,
    height = 200,
    orientation = 'horizontal',
    color = '#E07A5F', // terracotta
    title,
    onSelectionChange,
    onSelectionContextMenu,
    className,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentSelection, setCurrentSelection] = useState<MosaicSelectionEvent | null>(null);
    const selectionRef = useRef<MosaicSelectionEvent | null>(null);

    // Generate unique table name for this chart instance
    const tableNameRef = useRef(`chart_data_${Math.random().toString(36).slice(2)}`);

    // Load data and create chart
    useEffect(() => {
        let mounted = true;
        let plotElement: HTMLElement | null = null;

        async function setup() {
            if (!containerRef.current || data.length === 0) return;

            try {
                setIsLoading(true);
                setError(null);

                // Initialize coordinator
                await initCoordinator();

                const tableName = tableNameRef.current;

                // Create SQL to insert our data
                // First drop existing table if any
                await coordinator().exec(`DROP TABLE IF EXISTS ${tableName}`);

                // Create table and insert data
                const values = data
                    .map(d => `('${d.label.replace(/'/g, "''")}', ${d.value}, ${d.code !== undefined ? `'${d.code}'` : 'NULL'})`)
                    .join(',\n');

                await coordinator().exec(`
                    CREATE TABLE ${tableName} (label VARCHAR, value INTEGER, code VARCHAR);
                    INSERT INTO ${tableName} VALUES ${values};
                `);

                if (!mounted) return;

                // Create selection
                const $selection = vg.Selection.single();

                // Track selection changes
                $selection.addEventListener('value', () => {
                    const clauses = $selection.clauses;
                    if (clauses && clauses.length > 0) {
                        // Extract selected values from the selection predicate
                        const selectedLabels: string[] = [];
                        const selectedCodes: (number | string)[] = [];

                        // Parse the selection - Mosaic stores it as SQL predicates
                        for (const clause of clauses) {
                            if (clause.value !== undefined) {
                                const matchingDatum = data.find(d => d.label === clause.value);
                                if (matchingDatum) {
                                    selectedLabels.push(matchingDatum.label);
                                    if (matchingDatum.code !== undefined) {
                                        selectedCodes.push(matchingDatum.code);
                                    }
                                }
                            }
                        }

                        if (selectedLabels.length > 0) {
                            const selectionEvent: MosaicSelectionEvent = {
                                selectedLabels,
                                selectedCodes,
                                position: { x: 0, y: 0 }, // Will be updated on context menu
                            };
                            selectionRef.current = selectionEvent;
                            setCurrentSelection(selectionEvent);
                            onSelectionChange?.(selectionEvent);
                        }
                    } else {
                        selectionRef.current = null;
                        setCurrentSelection(null);
                        onSelectionChange?.(null);
                    }
                });

                // Build the plot specification
                const isHorizontal = orientation === 'horizontal';

                let plot;
                if (isHorizontal) {
                    plot = vg.plot(
                        vg.barX(
                            vg.from(tableName),
                            {
                                x: 'value',
                                y: 'label',
                                fill: color,
                                sort: { y: '-x' },
                            }
                        ),
                        vg.toggleY({ as: $selection }),
                        vg.highlight({ by: $selection }),
                        vg.width(width),
                        vg.height(height),
                        vg.marginLeft(100),
                        vg.marginRight(20),
                        vg.marginTop(title ? 30 : 10),
                        vg.marginBottom(30),
                        vg.xLabel(null),
                        vg.yLabel(null),
                    );
                } else {
                    plot = vg.plot(
                        vg.barY(
                            vg.from(tableName),
                            {
                                x: 'label',
                                y: 'value',
                                fill: color,
                                sort: { x: '-y' },
                            }
                        ),
                        vg.toggleX({ as: $selection }),
                        vg.highlight({ by: $selection }),
                        vg.width(width),
                        vg.height(height),
                        vg.marginLeft(40),
                        vg.marginRight(20),
                        vg.marginTop(title ? 30 : 10),
                        vg.marginBottom(60),
                        vg.xLabel(null),
                        vg.yLabel(null),
                    );
                }

                // Render the plot
                plotElement = await plot;

                if (!mounted || !containerRef.current) return;

                containerRef.current.replaceChildren(plotElement);

                // Add context menu handler
                plotElement.addEventListener('contextmenu', (e: MouseEvent) => {
                    e.preventDefault();
                    if (selectionRef.current && selectionRef.current.selectedLabels.length > 0) {
                        const event: MosaicSelectionEvent = {
                            ...selectionRef.current,
                            position: { x: e.clientX, y: e.clientY },
                        };
                        onSelectionContextMenu?.(event);
                    }
                });

                setIsLoading(false);
            } catch (err) {
                console.error('[MosaicBarChart] Error:', err);
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'Failed to create chart');
                    setIsLoading(false);
                }
            }
        }

        setup();

        return () => {
            mounted = false;
            // Cleanup: drop the table
            coordinator().exec(`DROP TABLE IF EXISTS ${tableNameRef.current}`).catch(() => { });
        };
    }, [data, width, height, orientation, color, title, onSelectionChange, onSelectionContextMenu]);

    if (error) {
        return (
            <div className={`${styles.container} ${className || ''}`}>
                <div className={styles.error}>
                    Error: {error}
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.container} ${className || ''}`}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {isLoading && <div className={styles.loading}>Loading chart...</div>}
            <div
                ref={containerRef}
                className={styles.chart}
                style={{ opacity: isLoading ? 0 : 1 }}
            />
            {currentSelection && currentSelection.selectedLabels.length > 0 && (
                <div className={styles.selectionInfo}>
                    Selected: {currentSelection.selectedLabels.join(', ')}
                </div>
            )}
        </div>
    );
};
