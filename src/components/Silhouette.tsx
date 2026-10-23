// The default card photo: a white square with a faint grey bust, framed.
export default function Silhouette({ className = '' }: { className?: string }) {
  return (
    <span className={`photo ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 48 48" width="48" height="48">
        <ellipse cx="24" cy="21" rx="6.5" ry="7.5" />
        <path d="M11 44c0-9 6-13 13-13s13 4 13 13v2H11z" />
      </svg>
    </span>
  );
}
