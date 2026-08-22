import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

const toneStyles: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-rose-50 text-rose-700 ring-rose-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/15",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/20",
};

export function Badge({ children, tone = "neutral", dot = true }: { children: ReactNode; tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap",
        toneStyles[tone]
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor(tone))} />}
      {children}
    </span>
  );
}

function dotColor(tone: Tone) {
  switch (tone) {
    case "success": return "bg-emerald-500";
    case "warning": return "bg-amber-500";
    case "danger": return "bg-rose-500";
    case "info": return "bg-sky-500";
    case "brand": return "bg-brand-500";
    default: return "bg-slate-400";
  }
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "Active":
    case "Approved":
    case "Completed":
    case "Success":
    case "Verified":
    case "Resolved":
    case "Confirmed":
    case "Converted":
      return "success";
    case "Inactive":
    case "Pending":
    case "Under Process":
    case "Planned":
    case "In Process":
    case "Open":
    case "Enquiry":
    case "Follow-up":
      return "warning";
    case "Deleted":
    case "Rejected":
    case "Cancelled":
    case "Failed":
    case "Aborted":
    case "Expired":
    case "Closed":
      return "danger";
    default:
      return "neutral";
  }
}
