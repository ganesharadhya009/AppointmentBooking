import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  icon,
  tint,
  sub,
  trend,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  tint: string;
  sub?: string;
  trend?: { value: string; up: boolean };
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", duration: 0.3 }}
      className="group relative overflow-hidden rounded-2xl bg-surface p-5 ring-1 ring-ink-900/[0.06] shadow-card"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.12] blur-xl transition-opacity group-hover:opacity-20"
        style={{ background: tint }}
      />
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${tint}18`, color: tint }}
        >
          {icon}
        </div>
        {trend && (
          <span className={cn("text-xs font-bold", trend.up ? "text-emerald-600" : "text-rose-500")}>
            {trend.up ? "↑" : "↓"} {trend.value}
          </span>
        )}
      </div>
      <div className="mt-4 text-2xl font-extrabold tracking-tight text-ink-950">{value}</div>
      <div className="mt-1 text-xs font-medium text-ink-700/55">{label}</div>
      {sub && <div className="mt-2 text-[11px] text-ink-700/40">{sub}</div>}
    </motion.div>
  );
}

export function MiniStat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-xl bg-slate-50 px-3.5 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-700/50">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
        {label}
      </span>
      <span className="text-lg font-bold text-ink-950">{value}</span>
    </div>
  );
}
