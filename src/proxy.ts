import { NextResponse, type NextRequest } from 'next/server';
import { isAllowedHost } from './lib/hosts';

// Refuse requests addressed to a host name this app doesn't know, before any
// page or API runs. See src/lib/hosts.ts.
export function proxy(request: NextRequest) {
  const host = request.headers.get('host');
  if (isAllowedHost(host, process.env.CONTACTS_ALLOWED_HOSTS)) return NextResponse.next();
  return new NextResponse(
    `localcontacts does not answer requests for "${host ?? ''}".\n` +
      'If this is how you reach it, add the name to CONTACTS_ALLOWED_HOSTS (see docs/DEPLOY.md).\n',
    { status: 421, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}

export const config = {
  matcher: '/((?!_next/static|_next/image).*)',
};
