import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const fixturePath = (name: string): string => join(__dirname, '..', 'fixtures', name);
export const fixture = (name: string): string => readFileSync(fixturePath(name), 'utf-8');
