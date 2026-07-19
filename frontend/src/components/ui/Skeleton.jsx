/**
 * components/ui/Skeleton.jsx
 * ------------------------------------------------------------
 * Shimmering placeholder used while data is loading. Rendered
 * instead of a spinner for a more premium feel. Respects the
 * user's reduced-motion preference via a static fallback.
 */
export default function Skeleton({ className = 'h-4 w-full', rounded = 'rounded-md' }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 ${rounded} ${className}`} aria-hidden="true" />;
}

// A composed skeleton block for card bodies.
export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card space-y-3" role="status" aria-label="Loading">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`w-${i === lines - 1 ? '2/3' : 'full'}`} />
      ))}
    </div>
  );
}
