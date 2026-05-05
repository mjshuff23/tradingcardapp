import { cn } from '../lib/ui';

type StatusPillTone = 'neutral' | 'success' | 'danger' | 'accent';

type StatusPillProps = {
  label: string;
  tone?: StatusPillTone;
  onClick?: () => void;
  className?: string;
  title?: string;
};

export function StatusPill({
  label,
  tone = 'neutral',
  onClick,
  className,
  title,
}: StatusPillProps) {
  const toneClasses: Record<StatusPillTone, string> = {
    neutral:
      'border-[var(--border)] bg-[var(--surface-soft)]/85 text-[var(--text-soft)]',
    success:
      'border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]',
    danger:
      'border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]',
    accent:
      'border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent-strong)]',
  };

  const classes = cn(
    'inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]',
    toneClasses[tone],
    onClick
      ? 'cursor-pointer outline-none hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:text-[var(--text)] focus:shadow-[var(--ring)]'
      : '',
    className,
  );

  if (onClick) {
    return (
      <button className={classes} type="button" onClick={onClick} title={title}>
        {label}
      </button>
    );
  }

  return (
    <span className={classes} title={title}>
      {label}
    </span>
  );
}
