/**
 * components/ui/PasswordInput.jsx
 * Reusable password input with show/hide toggle icon.
 * Uses secure input handling with type="password" by default.
 */
import { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export default function PasswordInput({ value, onChange, placeholder, label, error, minLength, required, autoComplete, disabled, id }) {
  const [visible, setVisible] = useState(false);
  const inputId = id || `password-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <div>
      {label && <label htmlFor={inputId} className="text-sm text-slate-300 mb-1 block">{label}</label>}
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          className="input pr-10 w-full"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? (
            <EyeSlashIcon className="h-5 w-5" />
          ) : (
            <EyeIcon className="h-5 w-5" />
          )}
        </button>
      </div>
      {error && <p className="text-danger text-xs mt-1" id={`${inputId}-error`} role="alert">{error}</p>}
    </div>
  );
}