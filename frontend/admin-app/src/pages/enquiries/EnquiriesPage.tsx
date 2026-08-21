import { useMemo, useState } from "react";
import { Link2, Plus, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea, FileDrop } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { useAppStore } from "@/store/appStore";
import type { Enquiry } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { therapyNamesList } from "@/lib/mockData";

export default function EnquiriesPage() {
  const { enquiries, branches, addEnquiry } = useAppStore();
  const [tab, setTab] = useState("list");
  const [statusFilter, setStatusFilter] = useState("");

  const submitted = enquiries.filter((e) => !e.isDraft);
  const drafts = enquiries.filter((e) => e.isDraft);

  const filtered = useMemo(
    () => submitted.filter((e) => !statusFilter || e.status === statusFilter),
    [submitted, statusFilter]
  );

  const columns: Column<Enquiry>[] = [
    { key: "parent", header: "Parent / Child", render: (e) => (
      <div className="flex items-center gap-3">
        <Avatar name={e.parentName} color="#4f46e5" size={32} />
        <div>
          <div className="font-semibold text-ink-900">{e.parentName}</div>
          <div className="text-xs text-ink-700/45">for {e.childName}</div>
        </div>
      </div>
    ) },
    { key: "contact", header: "Contact", render: (e) => e.contact },
    { key: "therapy", header: "Preferred Therapy", render: (e) => e.preferredTherapy },
    { key: "branch", header: "Branch", render: (e) => e.branchName },
    { key: "followUp", header: "Follow-up", render: (e) => (e.followUpAt ? formatDate(e.followUpAt) : "—") },
    { key: "status", header: "Status", render: (e) => <Badge tone={statusTone(e.status)}>{e.status}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Module 08"
        title="Enquiry Management"
        description="Pre-sales pipeline: capture family & clinical-concern data, then convert into an enrolled client."
        actions={
          <>
            <Button variant="secondary" icon={<Link2 size={14} />} onClick={() => alert("Public link copied: bimba.cdcconnect.in/enquiry/form")}>Copy Form Link</Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setTab("create")}>New Enquiry</Button>
          </>
        }
      />

      <div className="mb-5">
        <Tabs
          items={[
            { key: "list", label: "Enquiry List", count: submitted.length },
            { key: "drafts", label: "Draft List", count: drafts.length },
            { key: "create", label: "Create Enquiry" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "list" && (
        <>
          <FilterBar onExport={() => alert("Downloading enquiry export...")}>
            <Select label="Status" placeholder="All statuses" options={["Enquiry", "Follow-up", "Converted", "Closed"].map((s) => ({ label: s, value: s }))} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
            <Input label="From Date" type="date" />
            <Input label="To Date" type="date" />
          </FilterBar>
          <Card><DataTable columns={columns} data={filtered} searchKeys={["parentName", "childName", "contact"]} rowKey={(e) => e.id} /></Card>
        </>
      )}

      {tab === "drafts" && (
        <Card>
          <DataTable columns={columns} data={drafts} searchKeys={["parentName", "childName"]} rowKey={(e) => e.id} emptyLabel="No drafts pending completion" />
        </Card>
      )}

      {tab === "create" && <CreateEnquiryForm branches={branches} onCreate={addEnquiry} onDone={() => setTab("list")} />}
    </div>
  );
}

function CreateEnquiryForm({
  branches, onCreate, onDone,
}: {
  branches: { id: number; name: string; city: string }[];
  onCreate: (e: Omit<Enquiry, "id" | "createdAt" | "createdBy">) => void;
  onDone: () => void;
}) {
  const [parentName, setParentName] = useState("");
  const [contact, setContact] = useState("");
  const [childName, setChildName] = useState("");
  const [childDob, setChildDob] = useState("");
  const [therapy, setTherapy] = useState(therapyNamesList[0]);
  const [branchName, setBranchName] = useState(branches[0]?.name ?? "");
  const [concerns, setConcerns] = useState("");

  function submit(isDraft: boolean) {
    if (!parentName || !contact || !childName) return;
    const branch = branches.find((b) => b.name === branchName) ?? branches[0];
    onCreate({
      parentName, contact, childName, childDob: childDob || new Date().toISOString(),
      childGender: "Male", preferredTherapy: therapy, branchName: branch.name, city: branch.city,
      status: "Enquiry", isDraft, concerns: concerns ? concerns.split(",").map((c) => c.trim()) : [],
    });
    onDone();
  }

  return (
    <Card>
      <div className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><UserPlus size={15} /></div>
          <h3 className="text-sm font-bold text-ink-900">Basic Details</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Parent Name" required value={parentName} onChange={(e) => setParentName(e.target.value)} />
          <Input label="Contact Number" required value={contact} onChange={(e) => setContact(e.target.value)} />
          <Input label="Child Name" required value={childName} onChange={(e) => setChildName(e.target.value)} />
          <Input label="Child DOB" type="date" value={childDob} onChange={(e) => setChildDob(e.target.value)} />
          <Select label="Preferred Therapy" options={therapyNamesList.map((t) => ({ label: t, value: t }))} value={therapy} onChange={(e) => setTherapy(e.target.value)} />
          <Select label="Preferred Branch" options={branches.map((b) => ({ label: b.name, value: b.name }))} value={branchName} onChange={(e) => setBranchName(e.target.value)} />
        </div>

        <div className="my-5 h-px bg-ink-900/[0.06]" />

        <h3 className="mb-4 text-sm font-bold text-ink-900">Parental Concerns &amp; Medical Report</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Textarea label="Concerns (comma separated)" className="sm:col-span-2" value={concerns} onChange={(e) => setConcerns(e.target.value)} placeholder="Delayed speech, difficulty with social interaction..." />
          <FileDrop label="Diagnosis / Medical Report" />
          <FileDrop label="Parent ID Card" />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => submit(true)}>Save as Draft</Button>
          <Button variant="primary" onClick={() => submit(false)}>Submit Enquiry</Button>
        </div>
      </div>
    </Card>
  );
}
