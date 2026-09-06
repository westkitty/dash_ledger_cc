import { useId, type ReactNode } from 'react';

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {hint && <span className="field__hint">{hint}</span>}
      </label>
      {children}
      {error && (
        <div className="field__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

interface BaseProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
  autoFocus?: boolean;
  required?: boolean;
}

export function TextInput({ label, hint, error, value, onChange, placeholder, autoFocus, required }: BaseProps) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input
        id={id}
        className="input"
        type="text"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required={required}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function NumberInput({
  label,
  hint,
  error,
  value,
  onChange,
  placeholder,
  suggestion,
  onUseSuggestion,
  step = '1',
}: BaseProps & { suggestion?: string | null; onUseSuggestion?: () => void; step?: string }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input
        id={id}
        className="input tabular"
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        placeholder={placeholder}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
      />
      {suggestion != null && onUseSuggestion && (
        <button type="button" className="link-btn" onClick={onUseSuggestion}>
          Suggested: {suggestion} · tap to use
        </button>
      )}
    </Field>
  );
}

export function MoneyInput({ label, hint, error, value, onChange, placeholder = '0.00' }: BaseProps) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input
        id={id}
        className="input tabular"
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function DateInput({ label, hint, error, value, onChange }: BaseProps) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input
        id={id}
        className="input tabular"
        type="date"
        value={value}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function TimeInput({ label, hint, error, value, onChange }: BaseProps) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input
        id={id}
        className="input tabular"
        type="time"
        value={value}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function TextArea({ label, hint, error, value, onChange, placeholder }: BaseProps) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <textarea
        id={id}
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function SelectInput({
  label,
  hint,
  error,
  value,
  onChange,
  options,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: ReactNode;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="chips" role="group">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className="chip"
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </Field>
  );
}
