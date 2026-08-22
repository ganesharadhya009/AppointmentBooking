import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Link2, Plus, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { directoryApi, clientRecordsApi, ApiError, type PagedResult } from "@/lib/apiClient";
import { formatDate } from "@/lib/utils";

// EnquiryStatus matches ClientRecordsApi.Entities.EnquiryStatus exactly (Draft=0, Submitted=1, Converted=2).
const STATUS_LABELS = ["Draft", "Submitted", "Converted"];

interface BranchOption {
  id: string;
  name: string;
}

interface TherapyTypeOption {
  id: string;
  name: string;
  status: number;
}

interface Enquiry {
  id: string;
  parentName: string;
  parentMobileNumber: string;
  parentEmail: string | null;
  childName: string;
  childDateOfBirth: string | null;
  childGender: string | null;
  preferredTherapy: string | null;
  preferredLocation: string | null;
  concerns: string[];
  diagnosisReportUrl: string | null;
  parentIdCardUrl: string | null;
  status: number;
  followUpDate: string | null;
}

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [therapyTypes, setTherapyTypes] = useState<TherapyTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("list");
  const [statusFilter, setStatusFilter] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const [enquiryRes, branchRes, therapyRes] = await Promise.all([
        clientRecordsApi.get<PagedResult<Enquiry>>("/enquiries", { pageSize: 100 }),
        directoryApi.get<PagedResult<BranchOption>>("/branches", { pageSize: 100 }),
        directoryApi.get<PagedResult<TherapyTypeOption>>("/therapy-types", { pageSize: 100 }),
      ]);
      setEnquiries(enquiryRes.items);
      setBranches(branchRes.items);
      setTherapyTypes(therapyRes.items.filter((t) => t.status === 0));
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the backend.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const submitted = enquiries.filter((e) => e.status !== 0);
  const drafts = enquiries.filter((e) => e.status === 0);

  const filtered = useMemo(
    () => submitted.filter((e) => !statusFilter || STATUS_LABELS[e.status] === statusFilter),
    [submitted, statusFilter]
  );

  const columns: Column<Enquiry>[] = [
    {
      key: "parent",
      header: "Parent / Child",
      render: (e) => (
        <div className="flex items-center gap-3">
          <Avatar name={e.parentName} color="#4f46e5" size={32} />
          <div>
            <div className="font-semibold text-ink-900">{e.parentName}</div>
            <div className="text-xs text-ink-700/45">for {e.childName}</div>
          </div>
        </div>
      ),
    },
    { key: "contact", header: "Contact", render: (e) => e.parentMobileNumber },
    { key: "therapy", header: "Preferred Therapy", render: (e) => e.preferredTherapy ?? "—" },
    { key: "branch", header: "Branch", render: (e) => e.preferredLocation ?? "—" },
    { key: "followUp", header: "Follow-up", render: (e) => (e.followUpDate ? formatDate(e.followUpDate) : "—") },
    { key: "status", header: "Status", render: (e) => <Badge tone={statusTone(STATUS_LABELS[e.status])}>{STATUS_LABELS[e.status]}</Badge> },
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

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {tab === "list" && (
        <>
          <FilterBar onExport={() => alert("Downloading enquiry export...")}>
            <Select label="Status" placeholder="All statuses" options={STATUS_LABELS.map((s) => ({ label: s, value: s }))} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
            <Input label="From Date" type="date" />
            <Input label="To Date" type="date" />
          </FilterBar>
          <Card><DataTable columns={columns} data={filtered} searchKeys={["parentName", "childName", "parentMobileNumber"]} rowKey={(e) => e.id} emptyLabel={loading ? "Loading…" : "No enquiries yet"} /></Card>
        </>
      )}

      {tab === "drafts" && (
        <Card>
          <DataTable columns={columns} data={drafts} searchKeys={["parentName", "childName"]} rowKey={(e) => e.id} emptyLabel={loading ? "Loading…" : "No drafts pending completion"} />
        </Card>
      )}

      {tab === "create" && (
        <CreateEnquiryForm branches={branches} therapyTypes={therapyTypes} onDone={() => { reload(); setTab("list"); }} />
      )}
    </div>
  );
}

function CreateEnquiryForm({
  branches, therapyTypes, onDone,
}: {
  branches: BranchOption[];
  therapyTypes: TherapyTypeOption[];
  onDone: () => void;
}) {
  const [parentName, setParentName] = useState("");
  const [contact, setContact] = useState("");
  const [childName, setChildName] = useState("");
  const [childDob, setChildDob] = useState("");
  const [therapy, setTherapy] = useState("");
  const [branchName, setBranchName] = useState("");
  const [concerns, setConcerns] = useState("");
  const [diagnosisReportUrl, setDiagnosisReportUrl] = useState("");
  const [parentIdCardUrl, setParentIdCardUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(isDraft: boolean) {
    if (!parentName || !contact || !childName) {
      setError("Parent name, contact number and child name are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await clientRecordsApi.post("/enquiries", {
        parentName,
        parentMobileNumber: contact,
        childName,
        childDateOfBirth: childDob || null,
        preferredTherapy: therapy || null,
        preferredLocation: branchName || null,
        concerns: concerns ? concerns.split(",").map((c) => c.trim()).filter(Boolean).slice(0, 6) : [],
        diagnosisReportUrl: diagnosisReportUrl || null,
        parentIdCardUrl: parentIdCardUrl || null,
        status: isDraft ? 0 : 1,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this enquiry.");
    } finally {
      setSaving(false);
    }
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
          <Select label="Preferred Therapy" placeholder="Select therapy" options={therapyTypes.map((t) => ({ label: t.name, value: t.name }))} value={therapy} onChange={(e) => setTherapy(e.target.value)} />
          <Select label="Preferred Branch" placeholder="Select branch" options={branches.map((b) => ({ label: b.name, value: b.name }))} value={branchName} onChange={(e) => setBranchName(e.target.value)} />
        </div>

        <div className="my-5 h-px bg-ink-900/[0.06]" />

        <h3 className="mb-4 text-sm font-bold text-ink-900">Parental Concerns &amp; Medical Report</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Textarea label="Concerns (comma separated, up to 6)" className="sm:col-span-2" value={concerns} onChange={(e) => setConcerns(e.target.value)} placeholder="Delayed speech, difficulty with social interaction..." />
          <Input label="Diagnosis / Medical Report URL" value={diagnosisReportUrl} onChange={(e) => setDiagnosisReportUrl(e.target.value)} placeholder="https://…" />
          <Input label="Parent ID Card URL" value={parentIdCardUrl} onChange={(e) => setParentIdCardUrl(e.target.value)} placeholder="https://…" />
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => submit(true)} disabled={saving}>{saving ? "Saving…" : "Save as Draft"}</Button>
          <Button variant="primary" onClick={() => submit(false)} disabled={saving}>{saving ? "Saving…" : "Submit Enquiry"}</Button>
        </div>
      </div>
    </Card>
  );
}
