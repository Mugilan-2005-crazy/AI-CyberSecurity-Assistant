/**
 * components/ui/Loader.jsx
 * Simple full-width spinner / button spinner used across pages.
 */
export default function Loader({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
      <span>{label}</span>
    </div>
  );
}
