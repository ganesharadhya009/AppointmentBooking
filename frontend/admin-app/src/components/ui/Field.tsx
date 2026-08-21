import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

interface FieldWrapProps {
  label?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function FieldWrap({ label, required, hint, children, className }: FieldWrapProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-xs font-semibold text-ink-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {hint && <span className="text-[11px] text-ink-700/50">{hint}</span>}
    </div>
  );
}

const baseInput =
  "h-10 rounded-xl bg-slate-50 px-3.5 text-sm text-ink-900 ring-1 ring-inset ring-ink-900/10 placeholder:text-ink-700/35 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-brand-500/60";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
  hint?: string;
}
export function Input({ label, required, hint, className, ...props }: InputProps) {
  return (
    <FieldWrap label={label} required={required} hint={hint}>
      <input className={cn(baseInput, className)} {...props} />
    </FieldWrap>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  required?: boolean;
  hint?: string;
  options: { label: string; value: string }[];
  placeholder?: string;
}
export function Select({ label, required, hint, options, placeholder, className, ...props }: SelectProps) {
  return (
    <FieldWrap label={label} required={required} hint={hint}>
      <select className={cn(baseInput, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22 viewBox=%220 0 12 8%22><path d=%22M1 1l5 5 5-5%22 stroke=%22%23475569%22 stroke-width=%221.6%22 fill=%22none%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] bg-no-repeat bg-[right_0.9rem_center] pr-9", className)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldWrap>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  required?: boolean;
  hint?: string;
}
export function Textarea({ label, required, hint, className, ...props }: TextareaProps) {
  return (
    <FieldWrap label={label} required={required} hint={hint}>
      <textarea className={cn(baseInput, "h-24 py-2.5 resize-none")} {...props} />
    </FieldWrap>
  );
}

export function FileDrop({ label, hint, onFileName, className }: { label?: string; hint?: string; onFileName?: (name: string) => void; className?: string }) {
  return (
    <FieldWrap label={label} hint={hint} className={className}>
      <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink-900/12 bg-slate-50 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-brand-500">
          <path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[11px] font-medium text-ink-700/60">Click to upload or drag file</span>
        <input
          type="file"
          className="hidden"
          onChange={(e) => onFileName?.(e.target.files?.[0]?.name ?? "")}
        />
      </label>
    </FieldWrap>
  );
}
