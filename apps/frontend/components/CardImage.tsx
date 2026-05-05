import { useState } from 'react';
import { cn } from '../lib/ui';

type CardImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
};

export function CardImage({ src, alt, className }: CardImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-[24px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]',
          className,
        )}
      >
        <span>No image</span>
      </div>
    );
  }

  return (
    <img
      className={cn(
        'aspect-[3/4] w-full rounded-[24px] border border-[var(--border)] object-cover shadow-[var(--shadow-sm)]',
        className,
      )}
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
