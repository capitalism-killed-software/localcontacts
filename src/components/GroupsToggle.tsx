'use client';
import { useEffect, useRef, useState } from 'react';

// Lion's red ribbon bookmark. In Address Book 10.7 clicking it revealed the
// Groups column; here it shows or hides that column and remembers the choice.
const KEY = 'localcontacts.groups';

export default function GroupsToggle() {
  const ref = useRef<HTMLButtonElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(KEY) === 'hidden';
    } catch {
      // storage unavailable: default to shown
    }
    setHidden(stored);
  }, []);

  useEffect(() => {
    const book = ref.current?.closest('.book');
    if (book) book.setAttribute('data-groups', hidden ? 'hidden' : 'shown');
  }, [hidden]);

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(KEY, next ? 'hidden' : 'shown');
    } catch {
      // ignore
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      className="ribbon"
      onClick={toggle}
      aria-pressed={!hidden}
      aria-label={hidden ? 'Show groups' : 'Hide groups'}
      title={hidden ? 'Show groups' : 'Hide groups'}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <circle cx="5.5" cy="5" r="2.6" />
        <circle cx="11" cy="5.5" r="2.2" />
        <path d="M1 13.5c0-3 2-4.8 4.5-4.8S10 10.5 10 13.5z" />
        <path d="M9.6 13.5c0-2.4 1.2-3.9 2.9-4.3 1.6.3 2.5 1.8 2.5 4.3z" />
      </svg>
    </button>
  );
}
