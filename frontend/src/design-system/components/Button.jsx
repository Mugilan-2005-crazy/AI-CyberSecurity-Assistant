import { forwardRef } from 'react';

const VARIANT_CLASSES = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
  outline: 'border border-primary-600 text-primary-600 hover:bg-primary-50 focus:ring-primary-500',
  ghost: 'text-primary-600 hover:bg-primary-50 focus:ring-primary-500',
  cyber: 'bg-cyber-500 text-white hover:bg-cyber-600 focus:ring-cyber-400',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 focus:ring-danger-500',
  success: 'bg-success-500 text-white hover:bg-success-600 focus:ring-success-400',
  warning: 'bg-warning-500 text-white hover:bg-warning-600 focus:ring-warning-400',
};

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

const Button = forwardRef(
  (
    {
      as,
      to,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      icon: Icon,
      iconClassName,
      children,
      className = '',
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const Tag = as || (to ? 'a' : 'button');
    const isDisabled = disabled || loading;

    const classes = [
      'btn inline-flex items-center justify-center gap-2',
      'rounded-lg font-medium transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed',
      'active:scale-[0.98]',
      VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
      SIZE_CLASSES[size] || SIZE_CLASSES.md,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const content = (
      <>
        {loading ? (
          <span
            className={`animate-spin border-2 border-current border-t-transparent rounded-full ${
              size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
            }`}
            aria-hidden="true"
          />
        ) : (
          Icon && <Icon className={`${size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} ${iconClassName || ''}`} aria-hidden="true" />
        )}
        {children}
      </>
    );

    if (Tag === 'a') {
      return (
        <a
          ref={ref}
          href={to}
          className={classes}
          aria-disabled={isDisabled || undefined}
          {...(isDisabled ? { onClick: (e) => e.preventDefault() } : {})}
          {...rest}
        >
          {content}
        </a>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...rest}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;