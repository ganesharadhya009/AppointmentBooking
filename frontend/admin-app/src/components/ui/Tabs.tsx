import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

export function Tabs({ items, active, onChange }: { items: TabItem[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex w-full gap-1 overflow-x-auto rounded-xl bg-slate-100/80 p-1 scrollbar-none">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={cn(
              "relative whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              isActive ? "text-brand-700" : "text-ink-700/55 hover:text-ink-900"
            )}
          >
            {isActive && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_10px_-4px_rgba(15,23,42,0.15)]"
                transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    isActive ? "bg-brand-100 text-brand-700" : "bg-ink-900/8 text-ink-700/50"
                  )}
                >
                  {item.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
