// Excel-safe cells. A spreadsheet runs a cell that starts with = + - or @ (or a
// tab or carriage return before one) as a formula, so the page's export puts a
// ' in front of those, which the spreadsheet shows as text. Our importer takes
// one ' off again, for our own export's rows only. So that it can, a value that
// already starts with quotes and then one of those signs gets one more quote in
// every export, Excel-safe or not.
const FORMULA = /^[=+\-@\t\r]/;
const QUOTED_FORMULA = /^'+[=+\-@\t\r]/;

export function guardCell(v: string | null | undefined, excel: boolean): string | null | undefined {
  if (!v) return v;
  return QUOTED_FORMULA.test(v) || (excel && FORMULA.test(v)) ? `'${v}` : v;
}

/** The value a guarded cell of our own export stood for. */
export const unguardCell = (v: string): string => (QUOTED_FORMULA.test(v) ? v.slice(1) : v);
