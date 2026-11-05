import { NextResponse, type NextRequest } from 'next/server';
import { isAllowedHost, isWriteFromApp } from './lib/hosts';
import { MAX_IMPORT_BODY, TOO_LARGE_MESSAGE } from './lib/import/limits';

// Runs before every page, action and API route. See src/lib/hosts.ts.
// - Requests addressed to a host name this app doesn't know are refused (DNS rebinding).
// - Writes are refused unless they come from the app's own pages (another site open
//   in the browser must not change the book).
// - An import larger than the limit is refused before its body is read.

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const text = (status: number, body: string) =>
  new NextResponse(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

export function proxy(request: NextRequest) {
  const env = process.env.CONTACTS_ALLOWED_HOSTS;
  const host = request.headers.get('host');
  if (!isAllowedHost(host, env)) {
    return text(
      421,
      `localcontacts does not answer requests for "${host ?? ''}".\n` +
        'If this is how you reach it, add the name to CONTACTS_ALLOWED_HOSTS (see docs/DEPLOY.md).\n'
    );
  }
  if (WRITES.has(request.method)) {
    if (!isWriteFromApp(request.headers, env)) return text(403, 'localcontacts only accepts changes from its own pages.\n');
    const length = Number(request.headers.get('content-length'));
    if (request.nextUrl.pathname === '/api/import' && length > MAX_IMPORT_BODY) {
      return NextResponse.json({ error: TOO_LARGE_MESSAGE }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!_next/static|_next/image).*)',
};
