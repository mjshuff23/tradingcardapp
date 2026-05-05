import { ReactNode } from 'react';
import {
  cn,
  sectionHeaderClass,
} from '../lib/ui';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <section className={cn(sectionHeaderClass, 'gap-5 rounded-[32px]')}>
      <div>
        {eyebrow ? (
          <p className="mb-3 text-[0.75rem] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.06em] text-[var(--text)] [font-family:var(--font-display)] sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--text-soft)] sm:text-lg">
          {description}
        </p>
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </section>
  );
}
