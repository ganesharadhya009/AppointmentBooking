import { cn } from "@/lib/utils";

export function Toggle({ checked, onChange, size = "md" }: { checked: boolean; onChange: () => void; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const knob = size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]";
  const translate = size === "sm" ? (checked ? "translate-x-4" : "translate-x-0.5") : checked ? "translate-x-5" : "translate-x-0.5";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        dims,
        "relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        checked ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-slate-300"
      )}
    >
      <span
        className={cn(
          knob,
          "inline-block transform rounded-full bg-white shadow-md transition-transform duration-200",
          translate
        )}
      />
    </button>
  );
}
