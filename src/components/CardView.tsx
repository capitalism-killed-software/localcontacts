import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Contact } from '@/lib/contacts';
import { tagLabel } from '@/lib/groups';
import { splitName } from '@/lib/names';
import CopyButton from './CopyButton';
import { CardPhoto } from './Silhouette';

const lines = (v: string | null): string[] => (v ? v.split('\n').map((s) => s.trim()).filter(Boolean) : []);
// A link from an imported file becomes clickable only if it is a web, mail or
// phone link; anything else (javascript:, data:, file:) is shown as text.
export function safeHref(u: string): string | null {
  const t = u.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(t)) return t;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return null;
  return /^[\w-]+(\.[\w-]+)+(\/|$)/.test(t) ? `https://${t}` : null;
}

type FieldRow = { key: string; label: string; value: ReactNode; copy?: string };

export default function CardView({
  contact,
  editHref,
}: {
  contact: Contact;
  editHref: string;
}) {
  const { first, last, suffix } = splitName(contact.full_name);
  const emails = [contact.email, ...lines(contact.alt_emails)].filter((x): x is string => !!x);
  const phones = [contact.phone, ...lines(contact.alt_phones)].filter((x): x is string => !!x);
  const urls = lines(contact.urls);
  const sources = contact.sources ? contact.sources.split(',').map((t) => tagLabel(t.trim())).filter(Boolean) : [];

  const rows: FieldRow[] = [];
  if (emails.length === 0) {
    rows.push({ key: 'email', label: 'email', value: <Link href={editHref} className="quiet-link">add email…</Link> });
  }
  emails.forEach((e, i) =>
    rows.push({ key: `email-${i}`, label: i === 0 ? 'email' : 'other email', value: <a href={`mailto:${e}`}>{e}</a>, copy: e })
  );
  if (phones.length === 0) {
    rows.push({ key: 'phone', label: 'phone', value: <Link href={editHref} className="quiet-link">add phone…</Link> });
  }
  phones.forEach((p, i) => rows.push({ key: `phone-${i}`, label: i === 0 ? 'phone' : 'other phone', value: p, copy: p }));
  urls.forEach((u, i) => {
    const href = safeHref(u);
    rows.push({
      key: `url-${i}`,
      label: 'link',
      value: href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {u}
        </a>
      ) : (
        u
      ),
    });
  });
  const meta: FieldRow[] = [];
  if (contact.industry) meta.push({ key: 'industry', label: 'industry', value: contact.industry });
  if (contact.connected_on) meta.push({ key: 'connected', label: 'connected', value: contact.connected_on });
  if (contact.last_contacted) meta.push({ key: 'last_contacted', label: 'contacted', value: contact.last_contacted });
  if (sources.length) meta.push({ key: 'sources', label: 'sources', value: sources.join(', ') });

  const group = (items: FieldRow[]) =>
    items.map((r) => (
      <div className="field-row" key={r.key}>
        <dt className="field-label">{r.label}</dt>
        <dd className="field-value">
          {r.value}
          {r.copy && <CopyButton value={r.copy} label={r.label} />}
        </dd>
      </div>
    ));

  return (
    <div className="card">
      <header className="card-head">
        <CardPhoto id={contact.id} photoType={contact.photo_type} version={contact.updated_at} />
        <div className="card-titles">
          <h1 className="card-name">
            {first}
            {last && (
              <>
                {' '}
                <b>{last}</b>
              </>
            )}
            {suffix && ` ${suffix}`}
          </h1>
          {(contact.title || contact.company) && (
            <p className="card-company">{[contact.title, contact.company].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      </header>
      <hr className="card-divider" />
      <dl className="card-fields">
        <div className="field-group">{group(rows)}</div>
        {meta.length > 0 && <div className="field-group">{group(meta)}</div>}
        <div className="field-group">
          <div className="field-row field-note">
            <dt className="field-label">note</dt>
            <dd className="field-value card-note">
              {contact.notes ?? <Link href={editHref} className="quiet-link">add note…</Link>}
            </dd>
          </div>
        </div>
      </dl>
    </div>
  );
}
