export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export const shellClass = 'mx-auto w-full max-w-[1180px] px-4 sm:px-6';
export const pageStackClass = 'flex flex-col gap-6 sm:gap-8';
export const pageShellClass = 'py-6 sm:py-8 lg:py-10';
export const surfaceClass =
  'rounded-[30px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)] backdrop-blur-xl';
export const softSurfaceClass =
  'rounded-[26px] border border-[var(--border)] bg-[var(--surface-soft)] shadow-[var(--shadow-sm)] backdrop-blur-xl';
export const insetSurfaceClass =
  'rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';
export const sectionHeaderClass =
  'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between';
export const actionRowClass = 'flex flex-wrap items-center gap-3';
export const detailGridClass = 'grid gap-4 md:grid-cols-2';
export const detailItemClass =
  'rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)]/85 p-4';
export const fieldGridClass = 'grid gap-4 md:grid-cols-2 xl:grid-cols-3';
export const fieldClass = 'flex flex-col gap-2';
export const fieldLabelClass =
  'text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]';
export const detailLabelClass =
  'block text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]';
export const detailValueClass = 'mt-2 block text-sm leading-6 text-[var(--text)]';
export const inputClass =
  'w-full rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:shadow-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60';
export const textareaClass = `${inputClass} min-h-[140px] resize-y`;
export const finePrintClass = 'text-sm leading-6 text-[var(--text-soft)]';
export const sectionTitleClass =
  'text-xl font-semibold tracking-[-0.03em] text-[var(--text)] [font-family:var(--font-display)] sm:text-2xl';
export const surfaceTitleClass =
  'text-lg font-semibold tracking-[-0.03em] text-[var(--text)] [font-family:var(--font-display)]';
export const surfaceCopyClass = 'text-sm leading-6 text-[var(--text-soft)] sm:text-[0.95rem]';
export const primaryButtonClass =
  'inline-flex items-center justify-center rounded-full border border-[var(--accent-strong)] bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-sm)] outline-none hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] focus:shadow-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0';
export const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-soft)] px-5 py-3 text-sm font-semibold text-[var(--text)] outline-none hover:-translate-y-0.5 hover:bg-[var(--surface-strong)] focus:shadow-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0';
export const ghostButtonClass =
  'inline-flex items-center justify-center rounded-full border border-transparent px-4 py-2.5 text-sm font-medium text-[var(--text-soft)] outline-none hover:bg-[var(--surface-ghost)] hover:text-[var(--text)] focus:shadow-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60';
export const compactGhostButtonClass =
  'inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-soft)]/70 px-3.5 py-2 text-sm font-medium text-[var(--text-soft)] outline-none hover:bg-[var(--surface-strong)] hover:text-[var(--text)] focus:shadow-[var(--ring)]';
export const tableWrapClass =
  'overflow-hidden rounded-[30px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)] backdrop-blur-xl';
export const tableScrollClass = 'overflow-x-auto';
export const checkboxRowClass =
  'flex items-start gap-3 rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)]/85 p-4';
export const checkboxInputClass = 'mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]';
export const fileButtonClass = 'relative overflow-hidden';
export const hiddenFileInputClass = 'sr-only';

export function messageClass(
  tone: 'neutral' | 'success' | 'error' = 'neutral',
) {
  if (tone === 'success') {
    return 'rounded-[22px] border border-[var(--success)]/30 bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--text)]';
  }

  if (tone === 'error') {
    return 'rounded-[22px] border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--text)]';
  }

  return 'rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-soft)]';
}
