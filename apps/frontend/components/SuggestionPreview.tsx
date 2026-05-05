import {
  actionRowClass,
  finePrintClass,
  ghostButtonClass,
  primaryButtonClass,
  sectionHeaderClass,
  sectionTitleClass,
  softSurfaceClass,
  cn,
  messageClass,
} from '../lib/ui';

export type SuggestionPreviewItem = {
  field: string;
  previous: string;
  next: string;
};

type SuggestionPreviewProps = {
  title: string;
  subtitle: string;
  items: SuggestionPreviewItem[];
  emptyMessage: string;
  applyLabel: string;
  onApply: () => void;
  onDismiss: () => void;
};

export function SuggestionPreview({
  title,
  subtitle,
  items,
  emptyMessage,
  applyLabel,
  onApply,
  onDismiss,
}: SuggestionPreviewProps) {
  return (
    <section className={cn(softSurfaceClass, 'p-5 sm:p-6')}>
      <div className={sectionHeaderClass}>
        <div>
          <h2 className={sectionTitleClass}>{title}</h2>
          <p className={cn(finePrintClass, 'mt-2')}>{subtitle}</p>
        </div>
      </div>

      {items.length ? (
        <>
          <div className="mt-5 grid gap-3">
            {items.map((item) => (
              <div
                className="grid gap-2 rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)]/90 p-4 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center"
                key={`${item.field}-${item.next}`}
              >
                <strong className="text-sm font-semibold tracking-[0.02em] text-[var(--text)]">
                  {item.field}
                </strong>
                <span className="text-sm text-[var(--text-soft)]">{item.previous}</span>
                <span className="text-sm font-semibold text-[var(--accent-strong)]">To</span>
                <span className="text-sm text-[var(--text)]">{item.next}</span>
              </div>
            ))}
          </div>

          <div className={cn(actionRowClass, 'mt-5')}>
            <button className={primaryButtonClass} type="button" onClick={onApply}>
              {applyLabel}
            </button>
            <button className={ghostButtonClass} type="button" onClick={onDismiss}>
              Dismiss
            </button>
          </div>
        </>
      ) : (
        <p className={cn(messageClass(), 'mt-5')}>{emptyMessage}</p>
      )}
    </section>
  );
}
