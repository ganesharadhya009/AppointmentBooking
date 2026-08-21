import { useState } from "react";
import { RefreshCw, Edit2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Badge, statusTone } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { appointments } from "@/lib/mockData";
import { useAppStore } from "@/store/appStore";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Appointment } from "@/lib/types";

export default function AppointmentReportsPage() {
  const [tab, setTab] = useState("therapist");
  const { branches } = useAppStore();
  const therapy = appointments.filter((a) => a.type === "Therapy");
  const doctor = appointments.filter((a) => a.type === "Consultation");

  const baseColumns: Column<Appointment>[] = [
    { key: "child", header: "Child", render: (a) => <span className="font-semibold text-ink-900">{a.childName}</span> },
    { key: "provider", header: tab === "doctor" ? "Doctor" : "Therapist", render: (a) => a.therapistName },
    { key: "branch", header: "Branch", render: (a) => a.branchName },
    { key: "date", header: "Date", render: (a) => `${formatDate(a.date)} · ${a.time}` },
    { key: "amount", header: "Amount", align: "right", render: (a) => formatCurrency(a.amount) },
    { key: "bookedBy", header: "Booked By", render: (a) => <Badge tone="neutral">{a.bookedBy}</Badge> },
    { key: "status", header: "Status", render: (a) => <Badge tone={statusTone(a.status)}>{a.status}</Badge> },
    { key: "action", header: "Action", align: "right", render: () => (
      <div className="flex justify-end gap-1">
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><RefreshCw size={13} /></button>
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><Edit2 size={13} /></button>
      </div>
    ) },
  ];

  const allColumns: Column<Appointment>[] = [
    { key: "type", header: "Type", render: (a) => <Badge tone={a.type === "Therapy" ? "brand" : "info"}>{a.type}</Badge> },
    ...baseColumns,
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Reporting · Module 11"
        title="Appointment Reports"
        description="Three views of the same appointment ledger, split by provider type."
      />

      <div className="mb-5">
        <Tabs
          items={[
            { key: "therapist", label: "Therapist Appointments", count: therapy.length },
            { key: "doctor", label: "Doctor Appointments", count: doctor.length },
            { key: "all", label: "All Appointments", count: appointments.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <FilterBar onExport={() => alert("Exporting appointment report...")}>
        <Input label="From Date" type="date" />
        <Input label="To Date" type="date" />
        <Select label="Branch" placeholder="All branches" options={branches.map((b) => ({ label: b.name, value: b.name }))} />
        <Select label="Status" placeholder="All" options={["Planned", "Completed", "Cancelled"].map((s) => ({ label: s, value: s }))} />
      </FilterBar>

      <Card>
        {tab === "therapist" && <DataTable columns={baseColumns} data={therapy} searchKeys={["childName", "therapistName"]} rowKey={(a) => a.id} />}
        {tab === "doctor" && <DataTable columns={baseColumns} data={doctor} searchKeys={["childName", "therapistName"]} rowKey={(a) => a.id} />}
        {tab === "all" && <DataTable columns={allColumns} data={appointments} searchKeys={["childName", "therapistName"]} rowKey={(a) => a.id} />}
      </Card>
    </div>
  );
}
