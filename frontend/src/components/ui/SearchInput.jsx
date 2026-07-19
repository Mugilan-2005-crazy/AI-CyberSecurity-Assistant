/**
 * components/ui/SearchInput.jsx
 * ------------------------------------------------------------
 * Accessible search input with an inline icon and ARIA label.
 * Controlled component; lifts the query value to the parent.
 */
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function SearchInput({ value, onChange, placeholder = 'Search…', ariaLabel = 'Search' }) {
  return (
    <div className="relative">
      <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="input pl-9"
      />
    </div>
  );
}
