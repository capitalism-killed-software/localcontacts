// A download filename for a contact, safe on every OS. Returns the UTF-8
// name for filename*= and an ASCII fallback for filename=.
export function safeFilename(name: string, id: number): { utf8: string; ascii: string } {
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 64)
    .trim();
  const utf8 = cleaned || `contact-${id}`;
  const ascii =
    utf8
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[_\s.]+|[_\s.]+$/g, '') || `contact-${id}`;
  return { utf8, ascii };
}

export function attachmentHeader(base: string, id: number, ext: string): string {
  const { utf8, ascii } = safeFilename(base, id);
  return `attachment; filename="${ascii}.${ext}"; filename*=UTF-8''${encodeURIComponent(utf8)}.${ext}`;
}
