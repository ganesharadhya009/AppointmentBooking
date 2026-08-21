import { useState } from "react";
import { CalendarCheck, Edit2, FileBarChart, HeartPulse, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Card, CardBody } from "@/components/ui/Card";
import { useAppStore } from "@/store/appStore";
import type { ConsultantBranch, ConsultantDoctor, ConsultantService } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export default function ConsultantsPage() {
  const { consultantServices, consultantBranches, consultantDoctors } = useAppStore();
  const [tab, setTab] = useState("services");

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Module 07"
        title="Consultant Management"
        description="A parallel track for external consulting doctors operating out of partner clinics — services, clinics, and doctors."
        actions={<Button variant="primary" icon={<Plus size={15} />}>Add New</Button>}
      />

      <div className="mb-5">
        <Tabs
          items={[
            { key: "services", label: "Services", count: consultantServices.length },
            { key: "clinics", label: "Hospitals / Clinics", count: consultantBranches.length },
            { key: "doctors", label: "Doctors", count: consultantDoctors.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "services" && <ServicesGrid services={consultantServices} />}
      {tab === "clinics" && <ClinicsTable clinics={consultantBranches} />}
      {tab === "doctors" && <DoctorsTable doctors={consultantDoctors} />}
    </div>
  );
}

function ServicesGrid({ services }: { services: ConsultantService[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {services.map((s) => (
        <Card key={s.id}>
          <CardBody>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: s.imageColor }}>
              <HeartPulse size={18} />
            </div>
            <h3 className="mt-3 font-bold text-ink-950">{s.name}</h3>
            <div className="mt-3 flex items-center justify-between border-t border-ink-900/[0.06] pt-3">
              <Badge tone={statusTone(s.status)}>{s.status}</Badge>
              <Toggle checked={s.status === "Active"} onChange={() => {}} size="sm" />
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function ClinicsTable({ clinics }: { clinics: ConsultantBranch[] }) {
  const columns: Column<ConsultantBranch>[] = [
    { key: "name", header: "Clinic / Hospital", render: (c) => <span className="font-semibold text-ink-900">{c.name}</span> },
    { key: "lead", header: "Lead Contact", render: (c) => `${c.leadName} (${c.leadContact})` },
    { key: "city", header: "Location", render: (c) => `${c.city}, ${c.state}` },
    { key: "status", header: "Status", render: (c) => <Badge tone={statusTone(c.status)}>{c.status}</Badge> },
    { key: "action", header: "Action", align: "right", render: () => (
      <div className="flex justify-end gap-1">
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><CalendarCheck size={14} /></button>
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><Edit2 size={14} /></button>
      </div>
    ) },
  ];
  return <Card><DataTable columns={columns} data={clinics} searchKeys={["name", "city"]} rowKey={(c) => c.id} /></Card>;
}

function DoctorsTable({ doctors }: { doctors: ConsultantDoctor[] }) {
  const columns: Column<ConsultantDoctor>[] = [
    { key: "name", header: "Doctor", render: (d) => <span className="font-semibold text-ink-900">{d.name}</span> },
    { key: "service", header: "Service", render: (d) => <Badge tone="brand">{d.serviceName}</Badge> },
    { key: "clinic", header: "Clinic", render: (d) => d.clinicName },
    { key: "city", header: "City", render: (d) => d.city },
    { key: "fee", header: "Fee", align: "right", render: (d) => <span className="font-semibold">{formatCurrency(d.fee)}</span> },
    { key: "status", header: "Status", render: (d) => <Badge tone={statusTone(d.status)}>{d.status}</Badge> },
    { key: "action", header: "Action", align: "right", render: () => (
      <div className="flex justify-end gap-1">
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><CalendarCheck size={14} /></button>
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><FileBarChart size={14} /></button>
      </div>
    ) },
  ];
  return <Card><DataTable columns={columns} data={doctors} searchKeys={["name", "clinicName", "city"]} rowKey={(d) => d.id} /></Card>;
}
