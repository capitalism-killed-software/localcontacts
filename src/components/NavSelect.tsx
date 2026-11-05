'use client';
import { useRouter } from 'next/navigation';
import { confirmLeave } from '@/lib/leave-guard';

export type NavOption = { value: string; label: string; href: string };
export type NavGroup = { label: string; options: NavOption[] };

// A <select> whose choices are links: picking one navigates without
// scrolling the page. Used for the sort order and, on phones, the groups.
export default function NavSelect({
  value,
  options = [],
  groups = [],
  className = '',
  ariaLabel,
  placeholder,
}: {
  placeholder?: string; // shown while nothing is chosen (a menu rather than a choice)
  value: string;
  options?: NavOption[];
  groups?: NavGroup[];
  className?: string;
  ariaLabel: string;
}) {
  const router = useRouter();
  const hrefs = new Map<string, string>();
  for (const o of options) hrefs.set(o.value, o.href);
  for (const g of groups) for (const o of g.options) hrefs.set(o.value, o.href);
  return (
    <select
      className={className}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => {
        const href = hrefs.get(e.target.value);
        // The select is controlled, so a refused change snaps back to `value`.
        if (href && confirmLeave()) router.push(href, { scroll: false });
      }}
    >
      {placeholder !== undefined && (
        <option value="" disabled hidden>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
