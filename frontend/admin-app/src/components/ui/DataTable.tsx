import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchKeys?: (keyof T)[];
  pageSize?: number;
  toolbarRight?: ReactNode;
  rowKey: (row: T) => string | number;
  emptyLabel?: string;
}

export function DataTable<T>({
  columns,
  data,
  searchKeys,
  pageSize = 8,
  toolbarRight,
  rowKey,
  emptyLabel = "No records found",
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSize);

  const filtered = useMemo(() => {
    if (!query.trim() || !searchKeys?.length) return data;
    const q = query.toLowerCase();
    return data.filter((row) => searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q)));
  }, [data, query, searchKeys]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const clampedPage = Math.min(page, totalPages - 1);
  const start = clampedPage * size;
  const pageRows = filtered.slice(start, start + size);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-900/[0.06] px-5 py-3.5">
        <div className="flex items-center gap-2 text-xs text-ink-700/60">
          <span>Show</span>
          <select
            value={size}
            onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}
            className="h-7 rounded-md border-0 bg-slate-100 px-2 text-xs font-semibold text-ink-800 outline-none"
          >
            {[5, 8, 10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>entries</span>
        </div>
        <div className="flex items-center gap-2">
          {searchKeys && (
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/35" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(0); }}
                placeholder="Search..."
                className="h-8 w-48 rounded-lg bg-slate-100 pl-8 pr-3 text-xs outline-none ring-1 ring-inset ring-transparent transition-all focus:bg-white focus:ring-brand-400/60 sm:w-56"
              />
            </div>
          )}
          {toolbarRight}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink-900/[0.06] bg-slate-50/60">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-700/45",
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                  )}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16">
                  <div className="flex flex-col items-center justify-center gap-2 text-ink-700/40">
                    <Inbox size={28} strokeWidth={1.5} />
                    <span className="text-sm font-medium">{emptyLabel}</span>
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={rowKey(row)} className="border-b border-ink-900/[0.04] transition-colors last:border-0 hover:bg-brand-50/30">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-5 py-3.5 align-middle text-ink-800",
                        col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <span className="text-xs text-ink-700/50">
          {filtered.length === 0
            ? "No entries to show"
            : `Showing ${start + 1} to ${Math.min(start + size, filtered.length)} of ${filtered.length} entries`}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={clampedPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/60 transition-colors hover:bg-ink-900/5 disabled:opacity-30"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="px-2 text-xs font-semibold text-ink-800">
            {clampedPage + 1} / {totalPages}
          </span>
          <button
            disabled={clampedPage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/60 transition-colors hover:bg-ink-900/5 disabled:opacity-30"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
