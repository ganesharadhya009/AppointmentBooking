import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/store/appStore";
import type { Holiday } from "@/lib/types";
import { cn } from "@/lib/utils";

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function HolidaysPage() {
  const { holidays, branches, addHoliday, removeHoliday } = useAppStore();
  const [cursor, setCursor] = useState(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");

  const filtered = useMemo(() => holidays.filter((h) => !branchFilter || h.branchName === branchFilter), [holidays, branchFilter]);

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

  const columns: Column<Holiday>[] = [
    { key: "date", header: "Date", render: (h) => new Date(h.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) },
    { key: "branch", header: "Branch", render: (h) => <Badge tone="brand">{h.branchName}</Badge> },
    { key: "reason", header: "Reason", render: (h) => h.reason },
    { key: "action", header: "Action", align: "right", render: (h) => (
      <button onClick={() => removeHoliday(h.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-rose-50 hover:text-rose-600">
        <Trash2 size={14} />
      </button>
    ) },
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
        <Select label="Branch" placeholder="All branches" options={branches.map((b) => ({ label: b.name, value: b.name }))} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} />
        <Input label="From Date" type="date" />
        <Input label="To Date" type="date" />
      </FilterBar>

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
                      <span key={h.id} className="truncate rounded bg-rose-100 px-1 py-0.5 text-[9px] font-semibold text-rose-700">{h.branchName}</span>
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
            <DataTable columns={columns} data={filtered} searchKeys={["branchName", "reason"]} pageSize={6} rowKey={(h) => h.id} />
          </Card>
        </div>
      </div>

      <AddHolidayModal open={createOpen} onClose={() => setCreateOpen(false)} branches={branches} onCreate={addHoliday} />
    </div>
  );
}

function AddHolidayModal({
  open, onClose, branches, onCreate,
}: {
  open: boolean; onClose: () => void;
  branches: { id: number; name: string }[];
  onCreate: (h: Omit<Holiday, "id">) => void;
}) {
  const [date, setDate] = useState("");
  const [branchId, setBranchId] = useState("");
  const [reason, setReason] = useState("");

  function submit() {
    const branch = branches.find((b) => String(b.id) === branchId);
    if (!date || !branch || !reason) return;
    onCreate({ date: new Date(date).toISOString(), branchId: branch.id, branchName: branch.name, reason });
    onClose();
    setDate(""); setBranchId(""); setReason("");
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Add Holiday" subtitle="Mark a branch closed for a specific date."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Add Holiday</Button></>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <Select label="Branch" required placeholder="Select branch" options={branches.map((b) => ({ label: b.name, value: String(b.id) }))} value={branchId} onChange={(e) => setBranchId(e.target.value)} />
        <Textarea label="Reason" className="sm:col-span-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Ganesh Chaturthi" />
      </div>
    </Modal>
  );
}
