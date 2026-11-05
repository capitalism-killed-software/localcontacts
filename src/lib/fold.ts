// Text as search and sorting compare it: lower case (for every script, not
// just A-Z), accents removed (é → e, ñ → n), and the letters that don't
// decompose written plainly (ø → o, ł → l, æ → ae, ß → ss), so "nunez" finds
// Núñez and Øvreås files under O.

const PLAIN: Record<string, string> = {
  'ø': 'o', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'þ': 'th', 'ħ': 'h', 'ı': 'i', 'ŀ': 'l',
};

export const fold = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[øłđðæœßþħıŀ]/g, (c) => PLAIN[c]);

const digitsOf = (s: string): string => s.replace(/\D/g, '');

// Whether any stored number (the primary and the newline-separated others)
// matches the digits typed, whatever the formatting on either side; a typed
// country code (+1 ...) still finds a number stored without one.
export function phoneMatches(phone: string | null, others: string | null, typed: string): boolean {
  const q = digitsOf(typed);
  if (q.length < 4) return false;
  for (const n of [phone, ...(others ?? '').split('\n')]) {
    const d = digitsOf(n ?? '');
    if (d.length === 0) continue;
    if (d.includes(q) || (d.length >= 7 && q.length > d.length && q.endsWith(d))) return true;
  }
  return false;
}
