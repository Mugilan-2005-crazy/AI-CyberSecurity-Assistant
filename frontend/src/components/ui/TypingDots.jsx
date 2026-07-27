export default function TypingDots({ label = 'AI is thinking...' }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm text-slate-500 dark:text-slate-400 mr-1">{label}</span>
      <span className="flex items-center gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
      </span>
    </div>
  );
}
