import type { MetadataRoute } from 'next';

// Lets any browser install the app with an icon: Chrome, Edge and Brave on
// macOS, Linux and Windows, Chrome on Android, Safari on iOS and macOS.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'localcontacts',
    short_name: 'Contacts',
    description: 'Your contacts, in one local book. Nothing leaves your machine.',
    start_url: '/',
    display: 'standalone',
    background_color: '#2a2a2a',
    theme_color: '#6e4420',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
