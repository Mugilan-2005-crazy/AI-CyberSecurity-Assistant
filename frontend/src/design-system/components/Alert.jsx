import { forwardRef } from 'react';

const ALERT_VARIANTS = {
  info: {
    bg: 'bg-primary-50 dark:bg-primary-900/20',
    border: 'border-primary-200 dark:border-primary-800',
    icon: 'text-primary-600 dark:text-primary-400',
    title: 'text-primary-800 dark:text-primary-200',
    text: 'text-primary-700 dark:text-primary-300',
  },
  success: {
    bg: 'bg-success-50 dark:bg-success-900/20',
    border: 'border-success-200 dark:border-success-800',
    icon: 'text-success-600 dark:text-success-400',
    title: 'text-success-800 dark:text-success-200',
    text: 'text-success-700 dark:text-success-300',
  },
  warning: {
    bg: 'bg-warning-50 dark:bg-warning-900/20',
    border: 'border-warning-200 dark:border-warning-800',
    icon: 'text-warning-600 dark:text-warning-400',
    title: 'text-warning-800 dark:text-warning-200',
    text: 'text-warning-700 dark:text-warning-300',
  },
  danger: {
    bg: 'bg-danger-50 dark:bg-danger-900/20',
    border: 'border-danger-200 dark:border-danger-800',
    icon: 'text-danger-600 dark:text-danger-400',
    title: 'text-danger-800 dark:text-danger-200',
    text: 'text-danger-700 dark:text-danger-300',
  },
};

const Alert = forwardRef(
  ({ variant = 'info', title, children, className = '', ...rest }, ref) => {
    const v = ALERT_VARIANTS[variant] || ALERT_VARIANTS.info;
    return (
      <div
        ref={ref}
        role="alert"
        className={`rounded-lg border p-4 ${v.bg} ${v.border} ${className}`}
        {...rest}
      >
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 mt-0.5 ${v.icon}`} aria-hidden="true">
            {variant === 'danger' && (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
            {variant === 'warning' && (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {variant === 'success' && (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {variant === 'info' && (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            {title && <h4 className={`text-sm font-semibold ${v.title}`}>{title}</h4>}
            <div className={`text-sm ${v.text} mt-1 ${title ? '' : ''}`}>{children}</div>
          </div>
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export default Alert;