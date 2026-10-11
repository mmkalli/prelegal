import { useId, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue";

export function Input({ label, hint, id, ...props }: Props) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-neutral-800">
        {label}
      </label>
      <input id={inputId} className={inputClass} aria-describedby={hint ? `${inputId}-hint` : undefined} {...props} />
      {hint && (
        <p id={`${inputId}-hint`} className="text-xs text-brand-gray">
          {hint}
        </p>
      )}
    </div>
  );
}
