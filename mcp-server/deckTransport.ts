/**
 * MCP transport helpers for large BuiltDeck payloads (S4-MCP-2).
 * Pure formatting — no engine logic.
 */

import type { BuiltDeck, BuiltSlide, ResultEnvelope } from '../src/engine/types.js';

/** Max compact JSON size before switching to chunked multi-part responses. */
export const BUILD_DECK_SINGLE_PAYLOAD_MAX_BYTES = 256 * 1024;

/** Decks with at least this many slides use chunked transport (EVAL-01: 9-slide deck OOM on stdio). */
export const BUILD_DECK_CHUNK_MIN_SLIDES = 8;

/** Target max UTF-8 bytes per MCP text content part when chunking. */
export const BUILD_DECK_CHUNK_MAX_BYTES = 200 * 1024;

export type McpTextContent = { type: 'text'; text: string };

export interface FormatBuildDeckOptions {
  singlePayloadMaxBytes?: number;
  chunkMinSlides?: number;
  chunkMaxBytes?: number;
}

export function formatBuildDeckResponse(
  envelope: ResultEnvelope<BuiltDeck>,
  options: FormatBuildDeckOptions = {},
): { content: McpTextContent[] } {
  const singleMax = options.singlePayloadMaxBytes ?? BUILD_DECK_SINGLE_PAYLOAD_MAX_BYTES;
  const slideThreshold = options.chunkMinSlides ?? BUILD_DECK_CHUNK_MIN_SLIDES;
  const chunkMax = options.chunkMaxBytes ?? BUILD_DECK_CHUNK_MAX_BYTES;

  const slideCount = envelope.data.slides.length;
  const compact = JSON.stringify(envelope);
  const shouldChunk = slideCount >= slideThreshold || compact.length > singleMax;

  if (!shouldChunk) {
    return {
      content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
    };
  }

  return chunkBuildDeckEnvelope(envelope, chunkMax);
}

function chunkBuildDeckEnvelope(
  envelope: ResultEnvelope<BuiltDeck>,
  chunkMaxBytes: number,
): { content: McpTextContent[] } {
  const { slides, ...deckWithoutSlides } = envelope.data;

  const manifest = {
    transport: 'chunked' as const,
    operation: envelope.operation,
    inputs: envelope.inputs,
    durationMs: envelope.durationMs,
    warnings: envelope.warnings,
    metadata: envelope.metadata,
    data: {
      ...deckWithoutSlides,
      slideCount: slides.length,
    },
    reassembly:
      'Parse each following content part as JSON. Parts with transport "chunked-slide" provide slides by index. Set data.slides to the ordered array, then pass envelope.data to velocity_export_deck / velocity_commit_deck.',
  };

  const content: McpTextContent[] = [{ type: 'text', text: JSON.stringify(manifest) }];

  for (let index = 0; index < slides.length; index++) {
    const slide = slides[index];
    const part = { transport: 'chunked-slide' as const, index, slide };
    const text = JSON.stringify(part);
    if (Buffer.byteLength(text, 'utf8') > chunkMaxBytes) {
      throw new Error(
        `BuiltDeck slide ${index} exceeds MCP chunk limit (${chunkMaxBytes} bytes). Reduce slide scope or use fewer row variables.`,
      );
    }
    content.push({ type: 'text', text });
  }

  return { content };
}

/** Reassemble a ResultEnvelope<BuiltDeck> from velocity_build_deck MCP content parts. */
export function parseBuildDeckToolContent(content: McpTextContent[]): ResultEnvelope<BuiltDeck> {
  if (content.length === 0) {
    throw new Error('velocity_build_deck returned no content parts');
  }

  const first = JSON.parse(content[0].text) as ResultEnvelope<BuiltDeck> & {
    transport?: string;
    data: BuiltDeck & { slideCount?: number };
  };

  if (first.transport !== 'chunked') {
    return first as ResultEnvelope<BuiltDeck>;
  }

  const slideCount = first.data.slideCount ?? 0;
  const slides: BuiltSlide[] = new Array(slideCount);

  for (let i = 1; i < content.length; i++) {
    const part = JSON.parse(content[i].text) as {
      transport?: string;
      index?: number;
      slide?: BuiltSlide;
    };
    if (part.transport === 'chunked-slide' && typeof part.index === 'number' && part.slide) {
      slides[part.index] = part.slide;
    }
  }

  const { slideCount: _omit, ...deckData } = first.data;

  return {
    operation: first.operation,
    inputs: first.inputs,
    durationMs: first.durationMs,
    warnings: first.warnings,
    metadata: first.metadata,
    data: {
      ...deckData,
      slides,
    },
  };
}
