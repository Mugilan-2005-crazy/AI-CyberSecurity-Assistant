/**
 * components/ui/Button.jsx
 * ------------------------------------------------------------
 * Reusable, enterprise-grade Button component.
 *
 * Variants : primary | outline | ghost | cyber
 * Sizes    : sm | md | lg
 * Features : loading spinner, disabled state, icon slots,
 *            polymorphic `as`/`to` support (button / link).
 */
import { forwardRef } from 'react';

const VARIANT_CLASSES = {
  primary: 'btn-primary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  cyber: 'btn-cyber',
};

const SIZE_CLASSES = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

const ICON_SIZE_CLASSES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
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
      VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
      SIZE_CLASSES[size] || SIZE_CLASSES.md,
      'disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed',
      'focus:outline-none focus:ring-2 focus:ring-primary/50',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const content = (
      <>
        {loading ? (
          <span
            className={`animate-spin border-2 border-current border-t-transparent rounded-full ${ICON_SIZE_CLASSES[size]}`}
            aria-hidden="true"
          />
        ) : (
          Icon && <Icon className={`${ICON_SIZE_CLASSES[size]} ${iconClassName || ''}`} aria-hidden="true" />
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