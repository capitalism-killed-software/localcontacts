'use client';
import { useEffect } from 'react';
import { confirmLeave, hasUnsaved, setUnsaved } from '@/lib/leave-guard';

// Looks after the card form in edit mode:
// - Done works once: after the first submit the form's submit buttons are
//   disabled, which also stops a second Enter (a form whose default button is
//   disabled can't be submitted implicitly). A double-click made two cards.
// - Once something is typed, leaving the card by a link asks first (links
//   marked data-discard, like Cancel, don't), and so does closing the page.
export default function FormGuard({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    setUnsaved(false);
    const changed = () => setUnsaved(true);
    const submitted = () => {
      setUnsaved(false);
      queueMicrotask(() => {
        for (const b of document.querySelectorAll<HTMLButtonElement>(`button[type="submit"][form="${formId}"], #${formId} button[type="submit"]`)) {
          b.disabled = true;
        }
      });
    };
    const click = (e: MouseEvent) => {
      if (!hasUnsaved() || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]');
      if (!link || link.hasAttribute('download') || link.closest('[data-discard]') || form.contains(link)) return;
      if (!confirmLeave()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (hasUnsaved()) e.preventDefault();
    };
    form.addEventListener('input', changed);
    form.addEventListener('change', changed);
    form.addEventListener('submit', submitted);
    document.addEventListener('click', click, true);
    window.addEventListener('beforeunload', unload);
    return () => {
      form.removeEventListener('input', changed);
      form.removeEventListener('change', changed);
      form.removeEventListener('submit', submitted);
      document.removeEventListener('click', click, true);
      window.removeEventListener('beforeunload', unload);
      setUnsaved(false);
    };
  }, [formId]);
  return null;
}
