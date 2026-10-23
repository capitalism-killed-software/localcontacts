// A small Markdown-to-HTML converter for the app's own help pages: headings,
// paragraphs, ordered and unordered lists (with indented continuation
// lines), tables, fenced code, links, bold and inline code. Everything is
// escaped first, so the output can only contain the tags made here.

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const safeUrl = (u: string): string | null => (/^(https?:|mailto:|\/|#)/i.test(u) ? u : null);

export function inline(text: string): string {
  // Pull out code spans first so nothing inside them is formatted.
  const codes: string[] = [];
  let s = text.replace(/`([^`]+)`/g, (_, c: string) => {
    codes.push(`<code>${escapeHtml(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label: string, url: string) => {
    const href = safeUrl(url.replace(/&amp;/g, '&'));
    if (!href) return label;
    const external = /^https?:/i.test(href);
    return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noreferrer"' : ''}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)]);
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

const cells = (row: string): string[] =>
  row
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  const isBlockStart = (l: string) =>
    /^#{1,6}\s/.test(l) || /^```/.test(l) || /^\|/.test(l) || /^\d+\.\s/.test(l) || /^[-*]\s/.test(l) || l.trim() === '';

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level} id="${slug(h[2])}">${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }
    if (/^```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\|/.test(line)) {
      const rows: string[] = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const [head, , ...body] = rows;
      out.push(
        '<table><thead><tr>' +
          cells(head).map((c) => `<th>${inline(c)}</th>`).join('') +
          '</tr></thead><tbody>' +
          body.map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table>'
      );
      continue;
    }
    const listMatch = line.match(/^(\d+\.|[-*])\s+/);
    if (listMatch) {
      const ordered = /\d/.test(listMatch[1]);
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\d+\.|[-*])\s+(.*)$/);
        if (!m || /\d/.test(m[1]) !== ordered) break;
        let text = m[2];
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) text += ' ' + lines[i++].trim();
        items.push(`<li>${inline(text)}</li>`);
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && !isBlockStart(lines[i])) para.push(lines[i++].trim());
    if (para.length === 0) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}
