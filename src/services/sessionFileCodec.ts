const GZIP_MAGIC_BYTE_1 = 0x1f;
const GZIP_MAGIC_BYTE_2 = 0x8b;

function supportsCompressionStreams(): boolean {
  return typeof CompressionStream !== 'undefined';
}

function supportsDecompressionStreams(): boolean {
  return typeof DecompressionStream !== 'undefined';
}

export function isGzipBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 2) return false;
  const bytes = new Uint8Array(buffer);
  return bytes[0] === GZIP_MAGIC_BYTE_1 && bytes[1] === GZIP_MAGIC_BYTE_2;
}

async function gzipText(text: string): Promise<Uint8Array> {
  if (!supportsCompressionStreams()) {
    throw new Error('Gzip compression is not supported in this browser');
  }

  const encoder = new TextEncoder();
  // Writing directly via stream.writable can hang indefinitely in real browsers.
  // Piping a Blob stream through CompressionStream completes reliably.
  const compressedStream = new Blob([encoder.encode(text)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  const compressed = await new Response(compressedStream).arrayBuffer();
  return new Uint8Array(compressed);
}

async function gunzipBufferToText(buffer: ArrayBuffer): Promise<string> {
  if (!supportsDecompressionStreams()) {
    throw new Error('Gzip session import is not supported in this browser');
  }

  const decompressedStream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(decompressedStream).text();
}

export async function encodeSessionFile(
  jsonText: string,
  options?: { preferGzip?: boolean; gzipThresholdBytes?: number }
): Promise<{ blob: Blob; compressed: boolean }> {
  const preferGzip = options?.preferGzip ?? true;
  const gzipThresholdBytes = options?.gzipThresholdBytes ?? 32 * 1024;
  const payloadBytes = new TextEncoder().encode(jsonText).byteLength;

  if (preferGzip && payloadBytes >= gzipThresholdBytes && supportsCompressionStreams()) {
    const compressedBytes = await gzipText(jsonText);
    return {
      blob: new Blob([compressedBytes], { type: 'application/gzip' }),
      compressed: true,
    };
  }

  return {
    blob: new Blob([jsonText], { type: 'application/json' }),
    compressed: false,
  };
}

export async function decodeSessionFile(buffer: ArrayBuffer, fileName?: string): Promise<string> {
  const looksGzip = isGzipBuffer(buffer) || fileName?.toLowerCase().endsWith('.gz') === true;
  if (!looksGzip) {
    return new TextDecoder().decode(buffer);
  }

  return gunzipBufferToText(buffer);
}
