import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn, inputClass } from '../lib/ui';

export type ThemedSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type ThemedSelectProps = {
  value: string;
  options: ThemedSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function ThemedSelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Select an option',
}: ThemedSelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!open || !triggerRef.current || typeof window === 'undefined') {
      return;
    }

    const updateMenuPosition = () => {
      if (!triggerRef.current) {
        return;
      }

      const rect = triggerRef.current.getBoundingClientRect();
      const estimatedHeight = Math.min(options.length * 56 + 18, 320);
      const viewportPadding = 12;
      const bottomSpace = window.innerHeight - rect.bottom - viewportPadding;
      const topSpace = rect.top - viewportPadding;
      const openUpward = bottomSpace < Math.min(estimatedHeight, 220) && topSpace > bottomSpace;
      const maxHeight = Math.max(
        140,
        openUpward ? topSpace - 8 : window.innerHeight - rect.bottom - viewportPadding - 8,
      );
      const top = openUpward
        ? Math.max(viewportPadding, rect.top - Math.min(estimatedHeight, maxHeight))
        : rect.bottom + 8;

      setMenuStyle({
        position: 'fixed',
        top,
        left: rect.left,
        width: rect.width,
        maxHeight,
      });
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    updateMenuPosition();
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, options.length]);

  const menu = open && mounted && menuStyle
    ? createPortal(
        <div
          className="z-[70] overflow-auto rounded-[24px] border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-2 shadow-[var(--shadow-lg)] backdrop-blur-2xl"
          ref={menuRef}
          role="listbox"
          style={menuStyle}
        >
          {options.map((option) => (
            <button
              key={option.value}
              className={cn(
                'flex w-full flex-col items-start gap-1 rounded-[18px] px-3 py-3 text-left text-sm outline-none',
                option.value === value
                  ? 'bg-[var(--accent-soft)] text-[var(--text)]'
                  : 'text-[var(--text-soft)] hover:bg-[var(--surface-ghost)] hover:text-[var(--text)]',
                option.disabled ? 'cursor-not-allowed opacity-50' : '',
              )}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span className="font-medium">{option.label}</span>
              {option.description ? (
                <small className="text-xs text-[var(--muted)]">{option.description}</small>
              ) : null}
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div
        className={cn('relative', open ? 'z-20' : '', disabled ? 'opacity-60' : '')}
        ref={rootRef}
      >
        <button
          ref={triggerRef}
          className={cn(
            inputClass,
            'flex items-center justify-between gap-3 text-left',
            open ? 'border-[var(--border-strong)] shadow-[var(--ring)]' : '',
          )}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <span className="shrink-0 text-sm text-[var(--muted)]" aria-hidden="true">
            v
          </span>
        </button>
      </div>
      {menu}
    </>
  );
}
