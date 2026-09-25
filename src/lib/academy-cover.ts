import { AcademyError } from './academy-validation.ts';
export const MAX_COVER_BYTES = 2 * 1024 * 1024;
export const MAX_COVER_INPUT_BYTES = 5 * 1024 * 1024;

/** Check the encoded format and frame dimensions before Storage accepts any bytes. */
export function validateAcademyCover(bytes: Uint8Array, type: string): void {
  if (bytes.length > MAX_COVER_BYTES) throw new AcademyError(413, 'cover_too_large', 'Choose a cover smaller than 2 MiB.');
  if (type !== 'image/jpeg' || bytes.length < 20 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new AcademyError(400, 'invalid_cover', 'Use a valid JPEG cover. HTML and SVG are not supported.');
  let offset = 2; let dimensions = false;
  while (offset + 4 < bytes.length) {
    if (bytes[offset++] !== 255) break;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 218 || marker === 217) break;
    const length = (bytes[offset] << 8) + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if ([192, 193, 194].includes(marker) && length >= 8) {
      const height = (bytes[offset + 3] << 8) + bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) + bytes[offset + 6];
      dimensions = width > 0 && height > 0 && width <= 2560 && height <= 1440;
      break;
    }
    offset += length;
  }
  if (!dimensions) throw new AcademyError(400, 'invalid_cover', 'The cover could not be read or is larger than 2560 × 1440.');
}
export async function prepareAcademyCover(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_COVER_INPUT_BYTES) throw new Error('Choose a JPG, PNG or WebP image up to 5 MiB. Your previous cover is unchanged.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('This image could not be opened. Your previous cover is unchanged.'); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) throw new Error('Choose an image smaller than 40 megapixels.');
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Image preview is unavailable in this browser.');
    const scale = Math.max(1280 / bitmap.width, 720 / bitmap.height);
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 1280, 720);
    context.drawImage(bitmap, (1280 - bitmap.width * scale) / 2, (720 - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare the image.')), 'image/jpeg', 0.9));
    validateAcademyCover(new Uint8Array(await blob.arrayBuffer()), blob.type); return blob;
  } finally { bitmap.close(); }
}
export async function readAcademyCoverBody(request: Request): Promise<Uint8Array> {
  if (request.headers.get('content-type') !== 'image/jpeg') throw new AcademyError(415, 'unsupported_media_type', 'Upload a JPEG image.');
  const reader = request.body?.getReader(); if (!reader) throw new AcademyError(400, 'invalid_cover', 'Choose an image to upload.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > MAX_COVER_BYTES) { await reader.cancel(); throw new AcademyError(413, 'cover_too_large', 'Choose a cover smaller than 2 MiB.'); } chunks.push(part.value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  validateAcademyCover(bytes, 'image/jpeg'); return bytes;
}
