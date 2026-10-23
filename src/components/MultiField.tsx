'use client';
import { useState } from 'react';

type Row = { key: number; value: string };

// One row per value with the red remove and green add buttons from Address
// Book's edit mode. Every input shares the field name; the server takes the
// first non-empty one as the primary value.
export default function MultiField({
  name,
  label,
  values,
  type = 'text',
  placeholder,
}: {
  name: 'email' | 'phone' | 'url';
  label: string;
  values: string[];
  type?: 'text' | 'email' | 'tel';
  placeholder: string;
}) {
  const [rows, setRows] = useState<Row[]>(() => (values.length ? values : ['']).map((value, key) => ({ key, value })));
  const [nextKey, setNextKey] = useState(rows.length);

  const add = () => {
    setRows((r) => [...r, { key: nextKey, value: '' }]);
    setNextKey((k) => k + 1);
  };
  const remove = (key: number) =>
    setRows((r) => (r.length === 1 ? r.map((x) => ({ ...x, value: '' })) : r.filter((x) => x.key !== key)));
  const change = (key: number, value: string) => setRows((r) => r.map((x) => (x.key === key ? { ...x, value } : x)));

  return (
    <>
      {rows.map((r, i) => (
        <div className="edit-row" key={r.key}>
          <button type="button" className="round-btn minus" aria-label={`Remove ${label}`} onClick={() => remove(r.key)} />
          <span className="edit-label">{i === 0 ? label : `other ${label}`}</span>
          <input
            name={name}
            type={type}
            value={r.value}
            placeholder={placeholder}
            onChange={(e) => change(r.key, e.target.value)}
            className="edit-input"
            autoComplete="off"
          />
        </div>
      ))}
      <div className="edit-row edit-add">
        <button type="button" className="round-btn plus" aria-label={`Add ${label}`} onClick={add} />
        <span className="edit-label" />
        <button type="button" className="edit-add-text" onClick={add}>
          add {label}
        </button>
      </div>
    </>
  );
}
