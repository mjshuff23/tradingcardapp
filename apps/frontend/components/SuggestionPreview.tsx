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
    <section className="surface suggestion-panel">
      <div className="section-header">
        <div>
          <h2>{title}</h2>
          <p className="fine-print">{subtitle}</p>
        </div>
      </div>

      {items.length ? (
        <>
          <div className="suggestion-list">
            {items.map((item) => (
              <div className="suggestion-item" key={`${item.field}-${item.next}`}>
                <strong>{item.field}</strong>
                <span>{item.previous}</span>
                <span className="suggestion-arrow">→</span>
                <span>{item.next}</span>
              </div>
            ))}
          </div>

          <div className="action-row">
            <button className="button" type="button" onClick={onApply}>
              {applyLabel}
            </button>
            <button className="button-ghost" type="button" onClick={onDismiss}>
              Dismiss
            </button>
          </div>
        </>
      ) : (
        <p className="message">{emptyMessage}</p>
      )}
    </section>
  );
}
