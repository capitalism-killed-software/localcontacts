import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { markdownToHtml } from './markdown';

// docs/exporting-your-contacts.md, read by the help page (/help/export) and,
// one platform at a time, by the guided import.

const GUIDE_FILE = join(process.cwd(), 'docs', 'exporting-your-contacts.md');

export const exportGuide = (): string => readFileSync(GUIDE_FILE, 'utf-8');

export type GuideSection = { markdown: string; html: string };

/** Each "## Heading" section of the guide, by its heading. */
export function guideSections(md = exportGuide()): Map<string, GuideSection> {
  const out = new Map<string, GuideSection>();
  const parts = md.split(/^## +(.+)$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const markdown = parts[i + 1].trim();
    out.set(parts[i].trim(), { markdown, html: markdownToHtml(markdown) });
  }
  return out;
}
