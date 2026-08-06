import { forwardRef } from 'react';

const VARIANT_CLASSES = {
  primary: 'bg-primary-600 text-white border-primary-600',
  secondary: 'bg-white text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
  cyber: 'bg-cyber-500/10 text-cyber-400 border-cyber-500/30',
  danger: 'bg-danger-50 text-danger-600 border-danger-300 dark:bg-danger-900/20 dark:text-danger-400 dark:border-danger-700',
};

const INPUT_SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-4 py-3 text-base',
};

const Input = forwardRef(
  (
    {
      variant = 'primary',
      size = 'md',
      label,
      error,
      helperText,
      icon: Icon,
      className = '',
      ...rest
    },
    ref
  ) => {
    const inputClasses = [
      'w-full rounded-lg border transition-colors duration-200',
      'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
      'disabled:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50',
      'dark:bg-slate-900 dark:text-slate-100',
      VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
      INPUT_SIZES[size] || INPUT_SIZES.md,
      error ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : '',
      Icon ? 'pl-10' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <input ref={ref} className={inputClasses} aria-invalid={!!error} {...rest} />
        </div>
        {error && (
          <p className="mt-1 text-sm text-danger-600 dark:text-danger-400" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;