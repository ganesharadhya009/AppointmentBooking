import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Badge, statusTone } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Card, CardBody } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { DonutChart } from "@/components/ui/DonutChart";
import { appointments } from "@/lib/mockData";
import { useAppStore } from "@/store/appStore";
import { formatDate, randInt } from "@/lib/utils";
import type { Appointment } from "@/lib/types";
import { motion } from "framer-motion";

export default function CancellationReportsPage() {
  const [tab, setTab] = useState("branch");
  const { branches, therapists, parents } = useAppStore();
  const cancelled = appointments.filter((a) => a.status === "Cancelled");

  return (
    <div>
      <PageHeader
        eyebrow="Reporting · Module 12"
        title="Cancellation Reports"
        description="An operational branch view, and a parent-centric summary to spot high cancellation rates."
      />

      <div className="mb-5">
        <Tabs
          items={[
            { key: "branch", label: "Branch List", count: cancelled.length },
            { key: "parent", label: "Parent Card List", count: Math.min(parents.length, 12) },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "branch" ? <BranchList cancelled={cancelled} branches={branches} therapists={therapists} /> : <ParentCards parents={parents} />}
    </div>
  );
}

function BranchList({ cancelled, branches, therapists }: { cancelled: Appointment[]; branches: { name: string }[]; therapists: { name: string }[] }) {
  const columns: Column<Appointment>[] = [
    { key: "child", header: "Child", render: (a) => a.childName },
    { key: "parent", header: "Parent", render: (a) => a.parentName },
    { key: "branch", header: "Branch", render: (a) => a.branchName },
    { key: "therapist", header: "Therapist", render: (a) => a.therapistName },
    { key: "date", header: "Date", render: (a) => formatDate(a.date) },
    { key: "status", header: "Status", render: (a) => <Badge tone={statusTone(a.status)}>{a.status}</Badge> },
  ];
  return (
    <>
      <FilterBar>
        <Select label="Branch" placeholder="All branches" options={branches.map((b) => ({ label: b.name, value: b.name }))} />
        <Select label="Therapist" placeholder="All therapists" options={therapists.map((t) => ({ label: t.name, value: t.name }))} />
      </FilterBar>
      <Card><DataTable columns={columns} data={cancelled} searchKeys={["childName", "parentName"]} rowKey={(a) => a.id} /></Card>
    </>
  );
}

function ParentCards({ parents }: { parents: { id: number; name: string }[] }) {
  const cards = useMemo(
    () =>
      parents.slice(0, 12).map((p) => {
        const cancelled = randInt(0, 6);
        const completed = randInt(2, 20);
        const planned = randInt(0, 4);
        const pending = randInt(0, 2);
        const approved = Math.max(0, cancelled - pending - randInt(0, 1));
        const rejected = Math.max(0, cancelled - approved - pending);
        return { ...p, cancelled, completed, planned, pending, approved, rejected };
      }),
    [parents]
  );

  return (
    <>
      <FilterBar>
        <Select label="Range" placeholder="Current Month" options={[{ label: "Current Month", value: "current" }, { label: "Last 3 Months", value: "3m" }, { label: "This Year", value: "year" }]} />
      </FilterBar>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Card>
              <CardBody>
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} color="#4f46e5" size={38} />
                  <div>
                    <h3 className="font-bold text-ink-950">{p.name}</h3>
                    <p className="text-xs text-ink-700/45">{p.cancelled} cancellations</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <DonutChart
                    size={100}
                    centerValue={p.cancelled + p.completed + p.planned}
                    data={[
                      { name: "Completed", value: p.completed, color: "#10b981" },
                      { name: "Planned", value: p.planned, color: "#f59e0b" },
                      { name: "Cancelled", value: p.cancelled, color: "#f43f5e" },
                    ]}
                  />
                  <div className="flex flex-1 flex-col gap-1.5 text-xs">
                    <Row label="Completed" value={p.completed} color="#10b981" />
                    <Row label="Planned" value={p.planned} color="#f59e0b" />
                    <Row label="Approval Pending" value={p.pending} color="#0ea5e9" />
                    <Row label="Approved" value={p.approved} color="#8b5cf6" />
                    <Row label="Rejected" value={p.rejected} color="#f43f5e" />
                  </div>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        ))}
      </div>
    </>
  );
}

function Row({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-ink-700/55"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{label}</span>
      <span className="font-bold text-ink-900">{value}</span>
    </div>
  );
}
