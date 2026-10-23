// The default card photo: a white square with a faint grey bust, framed.
export function Bust() {
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <ellipse cx="24" cy="21" rx="6.5" ry="7.5" />
      <path d="M11 44c0-9 6-13 13-13s13 4 13 13v2H11z" />
    </svg>
  );
}

export default function Silhouette({ className = '' }: { className?: string }) {
  return (
    <span className={`photo ${className}`.trim()} aria-hidden="true">
      <Bust />
    </span>
  );
}

// The card's photo when it has one, the silhouette when it doesn't.
export function CardPhoto({ id, photoType, version }: { id: number; photoType: string | null; version: string }) {
  if (!photoType) return <Silhouette />;
  return (
    <span className="photo has-image">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/photo/${id}?v=${encodeURIComponent(version)}`} alt="" width={48} height={48} />
    </span>
  );
}
