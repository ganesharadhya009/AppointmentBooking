import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-600 to-teal-600 px-6 py-6 sm:px-8 sm:py-7"
    >
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-40" />
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl"
      />
      <div
        className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-teal-300/20 blur-2xl"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow && (
            <span className="mb-1.5 inline-block text-[11px] font-bold uppercase tracking-widest text-white/60">
              {eyebrow}
            </span>
          )}
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-[28px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-xl text-sm text-white/70">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </motion.div>
  );
}
