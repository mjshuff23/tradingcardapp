import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
        <div className="themed-select__menu" ref={menuRef} role="listbox" style={menuStyle}>
          {options.map((option) => (
            <button
              key={option.value}
              className={`themed-select__option${
                option.value === value ? ' is-selected' : ''
              }${option.disabled ? ' is-disabled' : ''}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.description ? <small>{option.description}</small> : null}
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div
        className={`themed-select${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}
        ref={rootRef}
      >
        <button
          ref={triggerRef}
          className="themed-select__trigger"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{selected?.label ?? placeholder}</span>
          <span className="themed-select__caret" aria-hidden="true">
            ▾
          </span>
        </button>
      </div>
      {menu}
    </>
  );
}
