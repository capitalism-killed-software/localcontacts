'use client';
import { useEffect } from 'react';

// Registers the no-op service worker in production so the app is installable.
export default function RegisterSw() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // not a secure context or storage unavailable: the app still works
    });
  }, []);
  return null;
}
