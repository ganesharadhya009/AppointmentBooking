import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { directoryApi, ApiError, type PagedResult } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface Holiday {
  id: string;
  branchId: string;
  date: string;
  reason: string;
}

interface BranchOption {
  id: string;
  name: string;
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");

  const branchNameById = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  async function reload() {
    setLoading(true);
    try {
      const [holidayRes, branchRes] = await Promise.all([
        directoryApi.get<PagedResult<Holiday>>("/holidays", { pageSize: 100 }),
        directoryApi.get<PagedResult<BranchOption>>("/branches", { pageSize: 100 }),
      ]);
      setHolidays(holidayRes.items);
      setBranches(branchRes.items);
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach directory-api.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(
    () => (branchFilter ? holidays.filter((h) => h.branchId === branchFilter) : holidays),
    [holidays, branchFilter]
  );

  const monthGrid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const holidaysByDay = useMemo(() => {
    const map = new Map<number, Holiday[]>();
    filtered.forEach((h) => {
      const d = new Date(h.date);
      if (d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth()) {
        const list = map.get(d.getDate()) ?? [];
        list.push(h);
        map.set(d.getDate(), list);
      }
    });
    return map;
  }, [filtered, cursor]);

  async function removeHoliday(id: string) {
    const prev = holidays;
    setHolidays((hs) => hs.filter((h) => h.id !== id));
    try {
      await directoryApi.delete(`/holidays/${id}`);
    } catch {
      setHolidays(prev);
    }
  }

  const columns: Column<Holiday>[] = [
    { key: "date", header: "Date", render: (h) => new Date(h.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) },
    { key: "branch", header: "Branch", render: (h) => <Badge tone="brand">{branchNameById.get(h.branchId) ?? "Unknown branch"}</Badge> },
    { key: "reason", header: "Reason", render: (h) => h.reason },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (h) => (
        <button onClick={() => removeHoliday(h.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-rose-50 hover:text-rose-600">
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Module 09"
        title="Holiday Management"
        description="Per-branch closure calendar feeding into appointment-slot availability."
        actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Add Holiday</Button>}
      />

      <FilterBar>
        <Select label="Branch" placeholder="All branches" options={branches.map((b) => ({ label: b.name, value: b.id }))} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} />
      </FilterBar>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="text-sm font-bold text-ink-900">{monthNames[cursor.getMonth()]} {cursor.getFullYear()}</div>
            <div className="flex items-center gap-1">
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/60 hover:bg-ink-900/5"><ChevronLeft size={15} /></button>
              <button onClick={() => setCursor(new Date())} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50">Today</button>
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/60 hover:bg-ink-900/5"><ChevronRight size={15} /></button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-ink-700/40">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1.5">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((day, i) => {
                const hs = day ? holidaysByDay.get(day) : undefined;
                const isToday = day === new Date().getDate() && cursor.getMonth() === new Date().getMonth() && cursor.getFullYear() === new Date().getFullYear();
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex min-h-[64px] flex-col gap-0.5 rounded-lg p-1.5 text-xs",
                      day ? "bg-slate-50" : "",
                      hs?.length ? "ring-1 ring-inset ring-rose-200 bg-rose-50/60" : ""
                    )}
                  >
                    {day && (
                      <span className={cn("mb-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold", isToday ? "bg-brand-600 text-white" : "text-ink-700/60")}>
                        {day}
                      </span>
                    )}
                    {hs?.slice(0, 2).map((h) => (
                      <span key={h.id} className="truncate rounded bg-rose-100 px-1 py-0.5 text-[9px] font-semibold text-rose-700">
                        {branchNameById.get(h.branchId) ?? "Unknown"}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader><div className="text-sm font-bold text-ink-900">Holiday List</div></CardHeader>
            <DataTable columns={columns} data={filtered} searchKeys={["reason"]} pageSize={6} rowKey={(h) => h.id} emptyLabel={loading ? "Loading…" : "No holidays yet"} />
          </Card>
        </div>
      </div>

      <AddHolidayModal open={createOpen} onClose={() => setCreateOpen(false)} branches={branches} onCreated={reload} />
    </div>
  );
}

function AddHolidayModal({
  open, onClose, branches, onCreated,
}: {
  open: boolean; onClose: () => void;
  branches: BranchOption[];
  onCreated: () => void;
}) {
  const [date, setDate] = useState("");
  const [branchId, setBranchId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate("");
    setBranchId("");
    setReason("");
    setError("");
  }, [open]);

  async function submit() {
    if (!date || !branchId || !reason) {
      setError("Date, branch and reason are all required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await directoryApi.post("/holidays", { branchId, date, reason });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create this holiday.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Add Holiday" subtitle="Mark a branch closed for a specific date."
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Add Holiday"}</Button>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <Select label="Branch" required placeholder="Select branch" options={branches.map((b) => ({ label: b.name, value: b.id }))} value={branchId} onChange={(e) => setBranchId(e.target.value)} />
        <Textarea label="Reason" className="sm:col-span-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Ganesh Chaturthi" />
      </div>
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </Modal>
  );
}
