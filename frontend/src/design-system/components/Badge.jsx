const TONES = {
  safe: 'bg-cyber-500/15 text-cyber-400',
  info: 'bg-primary/15 text-primary',
  warning: 'bg-amber-500/15 text-warning',
  danger: 'bg-red-500/15 text-danger',
  success: 'bg-cyber-500/15 text-cyber-400',
  neutral: 'bg-slate-500/15 text-slate-400',
};

export default function Badge({ tone = 'neutral', children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${TONES[tone] || TONES.neutral} ${className}`}>
      {children}
    </span>
  );
}