'use client';
import { useState } from 'react';
import { Bust } from './Silhouette';

// A photo that falls back to the silhouette when the browser can't draw it
// (a damaged or truncated image that still had a valid header).
export default function PhotoImg({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Bust />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={48} height={48} onError={() => setFailed(true)} />;
}
