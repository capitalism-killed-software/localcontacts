// Contact photos: recognised by their bytes, never trusted by their label,
// and never fetched from a URL (the app makes no network calls).

export type Photo = { type: PhotoType; data: Buffer };
export type PhotoType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export function sniffImage(b: Uint8Array): PhotoType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

const ascii = (b: Uint8Array, from: number, to: number): string =>
  from < 0 || to > b.length ? '' : String.fromCharCode(...b.subarray(from, to));

// JPEG start-of-frame markers (baseline, progressive, ...): the image itself.
const JPEG_FRAMES = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/**
 * Whether the bytes are a whole image of their type, not just its first few
 * bytes: a download cut short, or another file dressed up with an image's
 * signature, shows as a broken image. The checks are the format's own
 * landmarks: PNG's IHDR and IEND chunks, JPEG's frame header and end marker
 * (cameras may add data after it), GIF's trailer, WebP's RIFF length.
 */
export function isWholeImage(type: PhotoType, b: Uint8Array): boolean {
  let end = b.length;
  while (end > 0 && b[end - 1] === 0) end--; // zero padding after the end is harmless
  switch (type) {
    case 'image/png':
      return b.length >= 57 && ascii(b, 12, 16) === 'IHDR' && ascii(b, end - 8, end - 4) === 'IEND';
    case 'image/jpeg': {
      let frame = -1;
      for (let i = 2; i + 1 < end; i++) {
        if (b[i] === 0xff && JPEG_FRAMES.has(b[i + 1])) {
          frame = i;
          break;
        }
      }
      if (frame < 0) return false;
      for (let i = end - 2; i > frame && i >= end - 65536; i--) if (b[i] === 0xff && b[i + 1] === 0xd9) return true;
      return false;
    }
    case 'image/gif':
      return end >= 14 && /^GIF8[79]a$/.test(ascii(b, 0, 6)) && b[end - 1] === 0x3b;
    case 'image/webp': {
      const size = (b[4] | (b[5] << 8) | (b[6] << 16) | (b[7] << 24)) >>> 0;
      return size + 8 <= b.length && size + 8 >= end && ['VP8 ', 'VP8L', 'VP8X'].includes(ascii(b, 12, 16));
    }
  }
}

export type PhotoResult = { photo: Photo } | { error: 'not-image' | 'too-large' | 'empty' | 'damaged' };

export function photoFromBytes(bytes: Uint8Array): PhotoResult {
  if (bytes.length === 0) return { error: 'empty' };
  if (bytes.length > MAX_PHOTO_BYTES) return { error: 'too-large' };
  const type = sniffImage(bytes);
  if (!type) return { error: 'not-image' };
  if (!isWholeImage(type, bytes)) return { error: 'damaged' };
  return { photo: { type, data: Buffer.from(bytes) } };
}

export function photoFromBase64(b64: string): PhotoResult {
  const clean = b64.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(clean)) return { error: 'not-image' };
  return photoFromBytes(Buffer.from(clean, 'base64'));
}

// data:image/jpeg;base64,....
export function photoFromDataUri(uri: string): PhotoResult {
  const m = uri.trim().match(/^data:[^;,]*(;[^,]*)?,(.*)$/s);
  if (!m || !/;base64/i.test(m[1] ?? '')) return { error: 'not-image' };
  return photoFromBase64(m[2]);
}

export const PHOTO_EXT: Record<PhotoType, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/webp': 'WEBP',
};
