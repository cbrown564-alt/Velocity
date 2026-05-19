/**
 * Deck build MCP transport — unit tests (S4-MCP-2)
 */

import { describe, it, expect } from 'vitest';
import type { BuiltDeck, BuiltSlide, ResultEnvelope } from '../../src/engine/types.js';
import {
  BUILD_DECK_CHUNK_MAX_BYTES,
  formatBuildDeckResponse,
  parseBuildDeckToolContent,
} from '../deckTransport.js';

function makeSlide(index: number, rowPayloadSize = 80): BuiltSlide {
  const rows = Array.from({ length: rowPayloadSize }, (_, i) => ({
    row: `category-${index}`,
    col: `col-${i}`,
    count: i,
    pct: 0.1,
  }));
  return {
    spec: { rowVars: [`Q${index}`], visualizationType: 'chart' },
    sectionTitle: 'Section',
    result: {
      data: { rows },
      operation: 'runAnalysis:crosstab',
      inputs: { rowVars: [`Q${index}`] },
      durationMs: 2,
      warnings: [],
      metadata: {
        datasetName: 'test',
        rowCount: 100,
        filtersApplied: 0,
        isWeighted: false,
        engineVersion: 'test',
      },
    },
    processed: { rows: [] } as BuiltSlide['processed'],
    resolvedTitle: `Slide ${index}`,
    resolvedSubtitle: 'N = 100',
    resolvedChartType: 'horizontal-bar',
  };
}

function makeEnvelope(slideCount: number, rowPayloadSize = 80): ResultEnvelope<BuiltDeck> {
  const slides = Array.from({ length: slideCount }, (_, i) => makeSlide(i, rowPayloadSize));
  return {
    operation: 'buildDeck',
    inputs: { spec: { title: 'Deck', sections: [] } },
    durationMs: 10,
    warnings: [],
    metadata: {
      datasetName: 'test',
      rowCount: 100,
      filtersApplied: 0,
      isWeighted: false,
      engineVersion: 'test',
    },
    data: {
      spec: { title: 'Deck', sections: [{ title: 'S', slides: [] }] },
      slides,
      errors: [],
      buildDurationMs: 10,
    },
  };
}

describe('formatBuildDeckResponse', () => {
  it('returns a single pretty-printed part for small decks (backward compatible)', () => {
    const envelope = makeEnvelope(1, 2);
    const { content } = formatBuildDeckResponse(envelope);
    expect(content).toHaveLength(1);
    const parsed = JSON.parse(content[0].text);
    expect(parsed.transport).toBeUndefined();
    expect(parsed.data.slides).toHaveLength(1);
    expect(content[0].text).toContain('\n');
  });

  it('chunks decks with many slides into a manifest plus per-slide parts', () => {
    const envelope = makeEnvelope(10, 40);

    const { content } = formatBuildDeckResponse(envelope);
    expect(content.length).toBeGreaterThan(1);

    const manifest = JSON.parse(content[0].text);
    expect(manifest.transport).toBe('chunked');
    expect(manifest.data.slides).toBeUndefined();
    expect(manifest.data.slideCount).toBe(10);

    const slideParts = content.slice(1).map((c) => JSON.parse(c.text));
    expect(slideParts).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(slideParts[i].transport).toBe('chunked-slide');
      expect(slideParts[i].index).toBe(i);
      expect(slideParts[i].slide.resolvedTitle).toBe(`Slide ${i}`);
    }
  });

  it('chunks by payload size when slide count is below the slide threshold', () => {
    const envelope = makeEnvelope(3, 1200);
    const { content } = formatBuildDeckResponse(envelope, {
      chunkMinSlides: 100,
      singlePayloadMaxBytes: 50_000,
    });
    expect(content.length).toBeGreaterThan(1);
    expect(JSON.parse(content[0].text).transport).toBe('chunked');
  });

  it('keeps each chunked content part under the chunk byte budget when possible', () => {
    const envelope = makeEnvelope(10, 80);
    const { content } = formatBuildDeckResponse(envelope);
    for (const part of content) {
      const byteLength = Buffer.byteLength(part.text, 'utf8');
      expect(byteLength).toBeLessThanOrEqual(BUILD_DECK_CHUNK_MAX_BYTES * 1.05);
    }
  });
});

describe('parseBuildDeckToolContent', () => {
  it('round-trips a chunked build deck response', () => {
    const envelope = makeEnvelope(8, 350);
    const { content } = formatBuildDeckResponse(envelope);
    const restored = parseBuildDeckToolContent(content);
    expect(restored.operation).toBe('buildDeck');
    expect(restored.data.slides).toHaveLength(8);
    expect(restored.data.slides[3].resolvedTitle).toBe('Slide 3');
    expect(restored.data.buildDurationMs).toBe(10);
  });

  it('passes through a single-part legacy response', () => {
    const envelope = makeEnvelope(1, 1);
    const { content } = formatBuildDeckResponse(envelope);
    const restored = parseBuildDeckToolContent(content);
    expect(restored.data.slides).toHaveLength(1);
  });
});
