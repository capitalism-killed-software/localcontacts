import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SERVICES, slotWarning } from '../../src/lib/import/services';
import { exportGuide, guideSections } from '../../src/lib/export-guide';
import { tagProblem } from '../../src/lib/import/tags';
import { runImport } from '../../src/lib/import/run';

describe('the guided import’s services', () => {
  const sections = guideSections();

  it('each has its section in the export guide, with its export link in it and no commands', () => {
    for (const s of SERVICES) {
      const sec = sections.get(s.section);
      expect(sec, s.id).toBeDefined();
      if (s.exportUrl) expect(sec!.markdown, s.id).toContain(`](${s.exportUrl})`);
      expect(sec!.markdown, s.id).not.toMatch(/npm run/);
      expect(sec!.html, s.id).toContain('<');
    }
  });

  it('each tags its cards with a tag people could have typed themselves', () => {
    for (const s of SERVICES.filter((x) => x.tag)) expect(tagProblem(s.tag!, { typed: true }), s.id).toBeNull();
    expect(new Set(SERVICES.map((s) => s.id)).size).toBe(SERVICES.length);
  });

  it('warns, without refusing, when a file does not look like that service’s export', () => {
    const linkedin = SERVICES.find((s) => s.id === 'linkedin')!;
    const google = SERVICES.find((s) => s.id === 'google')!;
    expect(slotWarning(linkedin, 'linkedin-csv')).toBeNull();
    expect(slotWarning(google, 'linkedin-csv')).toMatch(/LinkedIn/);
    expect(slotWarning(google, 'vcard')).toBeNull();
  });

  it('the guide page and the sheet read the same file', () => {
    expect(exportGuide()).toBe(readFileSync(join(process.cwd(), 'docs', 'exporting-your-contacts.md'), 'utf-8'));
  });
});

describe('file reports', () => {
  it('say what a file looks like, even when a tag was given for it', () => {
    const bytes = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'linkedin-Connections.csv'));
    const r = runImport([{ name: 'Connections.csv', bytes, source: 'google' }]);
    expect(r.files[0]).toMatchObject({ source: 'google', detected: 'linkedin', format: 'linkedin-csv' });
  });
});
