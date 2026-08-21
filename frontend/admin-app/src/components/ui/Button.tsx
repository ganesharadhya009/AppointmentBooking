import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_8px_20px_-8px_rgba(79,70,229,0.55)] hover:from-brand-600 hover:to-brand-700 active:translate-y-px",
  secondary: "bg-white text-ink-800 ring-1 ring-inset ring-ink-900/10 shadow-soft hover:bg-slate-50",
  ghost: "text-ink-700 hover:bg-ink-900/5",
  danger: "bg-rose-500 text-white hover:bg-rose-600 shadow-[0_8px_20px_-8px_rgba(244,63,94,0.5)]",
  outline: "bg-transparent text-brand-700 ring-1 ring-inset ring-brand-300 hover:bg-brand-50",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-4 text-sm gap-2 rounded-xl",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-xl justify-center",
};

export function Button({ variant = "secondary", size = "md", icon, iconRight, className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center font-semibold transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none select-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}
