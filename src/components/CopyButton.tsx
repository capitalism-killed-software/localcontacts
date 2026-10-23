'use client';
import { useState } from 'react';

// Copies a value to the clipboard. Shown on hover next to emails and phones.
export default function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable: nothing to do
    }
  }

  return (
    <button type="button" onClick={copy} title={`Copy ${label ?? 'value'}`} className="copy-btn">
      {copied ? 'copied' : 'copy'}
    </button>
  );
}
