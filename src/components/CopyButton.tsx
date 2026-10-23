'use client';
import { useState } from 'react';

export default function CopyButton({
  value,
  label,
  className = '',
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${label ?? 'value'}`}
      className={`inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-0.5 text-xs text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 ${className}`}
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  );
}
