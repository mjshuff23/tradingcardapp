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
  const classes = ['status-pill', `status-pill--${tone}`, className, onClick ? 'status-pill--interactive' : '']
    .filter(Boolean)
    .join(' ');

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
