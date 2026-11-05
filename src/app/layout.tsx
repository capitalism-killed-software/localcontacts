import './globals.css';
import type { Metadata, Viewport } from 'next';
import RegisterSw from '@/components/RegisterSw';

export const metadata: Metadata = {
  title: 'Contacts',
  description: 'Your contacts, in one local book. Nothing leaves your machine.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Contacts', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#6e4420',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before the first paint: hide the Groups column if it was hidden last time. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('localcontacts.groups')==='hidden')document.documentElement.dataset.groups='hidden'}catch(e){}",
          }}
        />
      </head>
      <body>
        {children}
        <RegisterSw />
      </body>
    </html>
  );
}
