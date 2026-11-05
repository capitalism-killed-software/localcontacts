// Limits for one upload on the import page, shared by the route and src/proxy.ts
// (which refuses an oversized upload before reading it).
export const MAX_IMPORT_FILES = 50;
export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
export const TOO_LARGE_MESSAGE = 'The files add up to more than 100 MB.';
// The form around the files (names, boundaries, column choices) needs a little room.
export const MAX_IMPORT_BODY = MAX_IMPORT_BYTES + 1024 * 1024;
