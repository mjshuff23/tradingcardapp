import { useEffect, useMemo, useRef, useState } from 'react';

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
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current || rootRef.current.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  return (
    <div className={`themed-select${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <button
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

      {open ? (
        <div className="themed-select__menu" role="listbox">
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
              {option.description ? (
                <small>{option.description}</small>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
