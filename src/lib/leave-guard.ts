// Edit mode's unsaved changes. While a card's form has been changed, anything
// that would leave the card (a name, a group, the sort menu, Import…) asks
// first; Cancel and Done don't. See src/components/FormGuard.tsx.

let unsaved = false;

export const setUnsaved = (v: boolean): void => {
  unsaved = v;
};

export const hasUnsaved = (): boolean => unsaved;

export function confirmLeave(): boolean {
  if (!unsaved) return true;
  const ok = window.confirm('Discard your changes to this card?');
  if (ok) unsaved = false;
  return ok;
}
