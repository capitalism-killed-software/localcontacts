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
    <html lang="en">
      <body>
        {children}
        <RegisterSw />
      </body>
    </html>
  );
}
