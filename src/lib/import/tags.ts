// Source tags: the groups under "Sources" in the book (google, linkedin, work_friends, ...).
// One rule for the import page, the command line and tags read back from our own exports.

export const TAG_MAX = 40;
const TAG_CHARS = /^[A-Za-z0-9_.-]+$/;
// Names the Groups column already uses for its own entries.
const RESERVED = new Set(['all', 'untagged']);

/** Why a tag can't be used, or null when it can. */
export function tagProblem(tag: string): string | null {
  if (!tag) return 'A source tag cannot be empty.';
  if (tag.length > TAG_MAX) return `A source tag can be at most ${TAG_MAX} characters long.`;
  if (!TAG_CHARS.test(tag)) return 'A source tag may only use letters, digits, dots, dashes and underscores.';
  if (RESERVED.has(tag.toLowerCase())) return `"${tag}" is the name of a built-in group; choose another tag.`;
  return null;
}

/** Tags are stored in lower case, so "Work" and "work" are one group. */
export const normalizeTag = (tag: string): string => tag.trim().toLowerCase();

export const isTag = (tag: string): boolean => tagProblem(tag) === null;
