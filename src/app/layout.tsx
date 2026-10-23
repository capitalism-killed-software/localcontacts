import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contacts',
  description: 'Internal contact manager',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-neutral-200 bg-white">
            <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
              <Link href="/" className="text-lg font-semibold tracking-tight">Contacts</Link>
              <nav className="flex items-center gap-4 text-sm">
                <Link href="/" className="text-neutral-600 hover:text-neutral-900">All</Link>
                <Link
                  href="/contacts/new"
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-white hover:bg-neutral-800"
                >
                  + New contact
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
          <footer className="border-t border-neutral-200 bg-white">
            <div className="mx-auto max-w-6xl px-6 py-3 text-xs text-neutral-500">
              Local only · SQLite at <code className="font-mono">data/contacts.db</code>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
