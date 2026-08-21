import { useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

export function FilterBar({ children, onExport }: { children: ReactNode; onExport?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-5 overflow-hidden rounded-2xl bg-surface ring-1 ring-ink-900/[0.06] shadow-card">
      <div className="flex w-full items-center justify-between px-5 py-3.5 text-left">
        <button onClick={() => setOpen((o) => !o)} className="flex flex-1 items-center gap-2 text-left">
          <span className="flex items-center gap-2 text-sm font-bold text-ink-900">
            <SlidersHorizontal size={15} className="text-brand-600" />
            Search Filters
          </span>
        </button>
        <div className="flex items-center gap-2">
          {onExport && (
            <Button variant="outline" size="sm" icon={<Download size={13} />} onClick={onExport} className="mr-1">
              Export
            </Button>
          )}
          <button onClick={() => setOpen((o) => !o)} className="flex h-6 w-6 items-center justify-center">
            <ChevronDown size={16} className={cn("text-ink-700/40 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="grid grid-cols-1 gap-3 border-t border-ink-900/[0.06] px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ViewToggle({ view, onChange }: { view: "list" | "card"; onChange: (v: "list" | "card") => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
      {(["list", "card"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-colors",
            view === v ? "bg-white text-brand-700 shadow-soft" : "text-ink-700/50 hover:text-ink-900"
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
