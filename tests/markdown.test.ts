import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inline, markdownToHtml } from '../src/lib/markdown';

describe('inline', () => {
  it('formats links, bold and code, and escapes the rest', () => {
    expect(inline('Open **Settings** at [Google](https://google.com) and run `a < b`')).toBe(
      'Open <strong>Settings</strong> at <a href="https://google.com" target="_blank" rel="noreferrer">Google</a> and run <code>a &lt; b</code>'
    );
    expect(inline('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(inline('[x](javascript:alert(1))')).not.toContain('href');
    expect(inline('**Settings → [your name] → iCloud**')).toBe('<strong>Settings → [your name] → iCloud</strong>');
  });
});

describe('markdownToHtml', () => {
  it('renders headings, paragraphs, lists with continuation lines, tables and code', () => {
    const html = markdownToHtml(
      [
        '# Title',
        '',
        'Some text',
        'on two lines.',
        '',
        '1. First step,',
        '   continued.',
        '2. Second.',
        '',
        '| A | B |',
        '|---|---|',
        '| 1 | **2** |',
        '',
        '```bash',
        'npm run import -- <file>',
        '```',
      ].join('\n')
    );
    expect(html).toBe(
      [
        '<h1 id="title">Title</h1>',
        '<p>Some text on two lines.</p>',
        '<ol><li>First step, continued.</li><li>Second.</li></ol>',
        '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td><strong>2</strong></td></tr></tbody></table>',
        '<pre><code>npm run import -- &lt;file&gt;</code></pre>',
      ].join('\n')
    );
  });

  it('renders the real export guide without leftovers', () => {
    const html = markdownToHtml(readFileSync('docs/exporting-your-contacts.md', 'utf-8'));
    expect(html).toContain('<h2 id="google-contacts">Google Contacts</h2>');
    expect(html).toContain('<table>');
    expect(html).not.toMatch(/\*\*|\]\(|^#/m);
  });
});
