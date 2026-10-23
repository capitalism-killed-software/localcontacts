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

export type PhotoResult = { photo: Photo } | { error: 'not-image' | 'too-large' | 'empty' };

export function photoFromBytes(bytes: Uint8Array): PhotoResult {
  if (bytes.length === 0) return { error: 'empty' };
  if (bytes.length > MAX_PHOTO_BYTES) return { error: 'too-large' };
  const type = sniffImage(bytes);
  if (!type) return { error: 'not-image' };
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
