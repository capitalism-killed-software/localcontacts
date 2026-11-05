/** A card id from a URL: plain decimal digits naming a positive whole number, or null. */
export function parseId(raw: string | null | undefined): number | null {
  if (!raw || !/^[1-9][0-9]{0,15}$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}
