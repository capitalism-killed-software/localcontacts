'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

// Lion's search field. Typing filters the names list while every other
// param, including the open card, stays in the URL.
export default function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get('q') ?? '');
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set('q', value);
      else next.delete('q');
      if (next.toString() === params.toString()) return;
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Focus the field on desktop only; on a phone that would raise the keyboard
  // on every load.
  useEffect(() => {
    if (window.matchMedia('(min-width: 900px)').matches && document.activeElement === document.body) {
      ref.current?.focus();
    }
  }, []);

  return (
    <label className="search">
      <svg className="search-icon" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
        <circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.3 6.3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        ref={ref}
        type="search"
        placeholder="Search"
        aria-label="Search contacts"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </label>
  );
}
