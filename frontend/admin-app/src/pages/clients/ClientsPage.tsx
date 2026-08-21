import { useMemo, useState } from "react";
import { Edit2, FileBarChart, Lock, Unlock, Upload, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Badge, statusTone } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Card, CardBody } from "@/components/ui/Card";
import { Input, Select, FileDrop } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/store/appStore";
import type { ChildRecord, Parent } from "@/lib/types";
import { computeAge, formatDate } from "@/lib/utils";
import { motion } from "framer-motion";

export default function ClientsPage() {
  const [tab, setTab] = useState("parents");
  const { parents, children } = useAppStore();

  return (
    <div>
      <PageHeader
        eyebrow="Records · Module 13"
        title="Clients & Children"
        description="Parents and their children — the core customer record — with bulk onboarding support."
      />

      <div className="mb-5">
        <Tabs
          items={[
            { key: "parents", label: "Parent List", count: parents.length },
            { key: "cards", label: "Clients Card" },
            { key: "children", label: "Children" },
            { key: "active", label: "Active Children" },
            { key: "import", label: "Bulk Import" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "parents" && <ParentTable parents={parents} />}
      {tab === "cards" && <ParentCardGrid parents={parents} />}
      {tab === "children" && <ChildrenGrid children={children} />}
      {tab === "active" && <ActiveChildrenTable children={children} />}
      {tab === "import" && <BulkImport />}
    </div>
  );
}

function ParentTable({ parents }: { parents: Parent[] }) {
  const { toggleParentLock } = useAppStore();
  const columns: Column<Parent>[] = [
    { key: "name", header: "Parent", render: (p) => (
      <div className="flex items-center gap-3">
        <Avatar name={p.name} color="#4f46e5" size={32} />
        <div>
          <div className="font-semibold text-ink-900">{p.name}</div>
          <div className="text-xs text-ink-700/45">{p.email}</div>
        </div>
      </div>
    ) },
    { key: "contact", header: "Contact", render: (p) => p.contact },
    { key: "address", header: "Address", render: (p) => <span className="text-ink-700/60">{p.address}, {p.city}</span> },
    { key: "children", header: "Children", align: "center", render: (p) => <Badge tone="brand">{p.childrenCount}</Badge> },
    { key: "signup", header: "Signed Up", render: (p) => formatDate(p.signupDate) },
    { key: "status", header: "Status", render: (p) => <Badge tone={statusTone(p.status)}>{p.status}</Badge> },
    { key: "action", header: "Action", align: "right", render: (p) => (
      <div className="flex justify-end gap-1">
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><FileBarChart size={14} /></button>
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><Edit2 size={14} /></button>
        <button onClick={() => toggleParentLock(p.id)} className={`flex h-7 w-7 items-center justify-center rounded-lg ${p.locked ? "bg-rose-50 text-rose-600" : "text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"}`}>
          {p.locked ? <Lock size={13} /> : <Unlock size={13} />}
        </button>
      </div>
    ) },
  ];
  return (
    <>
      <FilterBar onExport={() => alert("Exporting parent list...")}>
        <Input label="Sign-up From" type="date" />
        <Input label="Sign-up To" type="date" />
        <Input label="Contact Number" placeholder="Search by phone" />
      </FilterBar>
      <Card><DataTable columns={columns} data={parents} searchKeys={["name", "contact", "email"]} rowKey={(p) => p.id} /></Card>
    </>
  );
}

function ParentCardGrid({ parents }: { parents: Parent[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {parents.slice(0, 16).map((p, i) => (
        <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
          <Card>
            <CardBody>
              <div className="flex items-center gap-3">
                <Avatar name={p.name} color="#0d9488" size={40} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold text-ink-950">{p.name}</h3>
                  <p className="truncate text-xs text-ink-700/45">{p.contact}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <div className="flex-1 rounded-lg bg-slate-50 px-2.5 py-2 text-center">
                  <div className="text-sm font-extrabold text-ink-950">{p.appointmentsCount}</div>
                  <div className="text-[10px] text-ink-700/45">Appointments</div>
                </div>
                <div className="flex-1 rounded-lg bg-slate-50 px-2.5 py-2 text-center">
                  <div className="text-sm font-extrabold text-ink-950">{formatDate(p.signupDate, { day: "2-digit", month: "short" })}</div>
                  <div className="text-[10px] text-ink-700/45">Signed up</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function ChildrenGrid({ children }: { children: ChildRecord[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children.slice(0, 16).map((c, i) => (
        <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
          <Card>
            <CardBody>
              <div className="flex items-center gap-3">
                <Avatar name={c.name} color="#f59e0b" size={40} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold text-ink-950">{c.name}</h3>
                  <p className="text-xs text-ink-700/45">{computeAge(c.dob)} yrs &middot; {c.guardian}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                <MiniCounter label="Planned" value={c.planned} color="#f59e0b" />
                <MiniCounter label="Done" value={c.completed} color="#10b981" />
                <MiniCounter label="Cancel" value={c.cancelled} color="#f43f5e" />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-ink-900/[0.06] pt-3">
                <span className="text-[11px] text-ink-700/45">{c.branchName}</span>
                <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><Edit2 size={13} /></button>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function MiniCounter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-1.5">
      <div className="text-sm font-extrabold" style={{ color }}>{value}</div>
      <div className="text-[9px] font-medium text-ink-700/40">{label}</div>
    </div>
  );
}

function ActiveChildrenTable({ children }: { children: ChildRecord[] }) {
  const { branches } = useAppStore();
  const [branchFilter, setBranchFilter] = useState("");
  const filtered = useMemo(() => children.filter((c) => !branchFilter || c.branchName === branchFilter), [children, branchFilter]);

  const columns: Column<ChildRecord>[] = [
    { key: "name", header: "Child", render: (c) => <span className="font-semibold text-ink-900">{c.name}</span> },
    { key: "dob", header: "DOB (Age)", render: (c) => `${formatDate(c.dob)} (${computeAge(c.dob)}y)` },
    { key: "guardian", header: "Guardian", render: (c) => `${c.guardian} · ${c.phone}` },
    { key: "branch", header: "Branch", render: (c) => c.branchName },
    { key: "planned", header: "Planned", align: "center", render: (c) => c.planned },
    { key: "completed", header: "Completed", align: "center", render: (c) => c.completed },
    { key: "cancelled", header: "Cancelled", align: "center", render: (c) => c.cancelled },
  ];
  return (
    <>
      <FilterBar>
        <Select label="Branch" placeholder="All branches" options={branches.map((b) => ({ label: b.name, value: b.name }))} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} />
        <Input label="From Date" type="date" />
        <Input label="To Date" type="date" />
      </FilterBar>
      <Card><DataTable columns={columns} data={filtered} searchKeys={["name", "guardian"]} rowKey={(c) => c.id} /></Card>
    </>
  );
}

function BulkImport() {
  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-4 py-14 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Upload size={26} />
        </div>
        <div>
          <h3 className="text-base font-bold text-ink-950">Bulk import existing clients</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-700/55">Upload a named Excel (.xls / .xlsx) file to onboard existing families in bulk.</p>
        </div>
        <div className="w-full max-w-sm"><FileDrop hint="Accepted formats: .xls, .xlsx" /></div>
        <div className="flex gap-2">
          <Button variant="outline" icon={<Download size={14} />}>Download Template</Button>
          <Button variant="primary" icon={<Upload size={14} />}>Upload &amp; Import</Button>
        </div>
      </CardBody>
    </Card>
  );
}
