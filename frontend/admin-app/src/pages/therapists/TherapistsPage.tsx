import { useMemo, useState } from "react";
import { Edit2, FileBarChart, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar, ViewToggle } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, FileDrop } from "@/components/ui/Field";
import { Card, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { useAppStore } from "@/store/appStore";
import type { SessionWindow, Therapist, TherapistAssignment } from "@/lib/types";
import { dayList, therapyNamesList } from "@/lib/mockData";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const windowLabels: SessionWindow["label"][] = ["Morning", "Noon", "Afternoon", "Evening"];

function blankWindow(label: SessionWindow["label"]): SessionWindow {
  return { label, start: "09:00", end: "12:00", price: 500, enabled: label === "Morning" };
}
function blankAssignment(branchId: number, branchName: string): TherapistAssignment {
  return {
    branchId, branchName, therapyName: therapyNamesList[0], joiningDate: new Date().toISOString().slice(0, 10),
    dayOff: "Sunday", lunchBreak: "1:00 PM - 2:00 PM",
    windows: windowLabels.map(blankWindow),
  };
}

export default function TherapistsPage() {
  const { therapists, branches, toggleTherapistStatus, addTherapist } = useAppStore();
  const [view, setView] = useState<"list" | "card">("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(
    () =>
      therapists.filter(
        (t) =>
          (!branchFilter || t.assignments.some((a) => a.branchName === branchFilter)) &&
          (!statusFilter || t.status === statusFilter)
      ),
    [therapists, branchFilter, statusFilter]
  );

  const columns: Column<Therapist>[] = [
    {
      key: "name", header: "Therapist", render: (t) => (
        <div className="flex items-center gap-3">
          <Avatar name={t.name} color={t.avatarColor} size={34} />
          <div>
            <div className="font-semibold text-ink-900">{t.name}</div>
            <div className="text-xs text-ink-700/45">{t.domainSpecialist}</div>
          </div>
        </div>
      )
    },
    { key: "mobile", header: "Contact", render: (t) => t.mobile },
    { key: "branches", header: "Branch / Therapy", render: (t) => (
      <div className="flex flex-wrap gap-1">
        {t.assignments.slice(0, 2).map((a, i) => (
          <span key={i} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">{a.branchName}</span>
        ))}
        {t.assignments.length > 2 && <span className="text-[11px] text-ink-700/40">+{t.assignments.length - 2} more</span>}
      </div>
    ) },
    { key: "status", header: "Status", render: (t) => (
      <div className="flex items-center gap-2">
        {t.status !== "Deleted" && <Toggle checked={t.status === "Active"} onChange={() => toggleTherapistStatus(t.id)} size="sm" />}
        <Badge tone={statusTone(t.status)}>{t.status}</Badge>
      </div>
    ) },
    { key: "action", header: "Action", align: "right", render: () => (
      <div className="flex justify-end gap-1">
        <IconBtn icon={<FileBarChart size={14} />} />
        <IconBtn icon={<Edit2 size={14} />} />
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Module 06"
        title="Multi-Therapist Management"
        description="Therapist onboarding, credentials, and per-branch session-window scheduling with independent pricing."
        actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Create Therapist</Button>}
      />

      <FilterBar onExport={() => alert("Exporting therapist list...")}>
        <Select label="Branch" placeholder="All branches" options={branches.map((b) => ({ label: b.name, value: b.name }))} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} />
        <Select label="Status" placeholder="All statuses" options={[{ label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }, { label: "Deleted", value: "Deleted" }]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
        <div className="flex items-end lg:col-span-2 lg:justify-end">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </FilterBar>

      {view === "list" ? (
        <Card><DataTable columns={columns} data={filtered} searchKeys={["name", "mobile", "domainSpecialist"]} rowKey={(t) => t.id} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <Avatar name={t.name} color={t.avatarColor} size={44} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-ink-950">{t.name}</h3>
                      <p className="truncate text-xs text-ink-700/50">{t.designation}</p>
                    </div>
                    <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.assignments.map((a, idx) => (
                      <span key={idx} className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
                        {a.branchName} &middot; {a.therapyName}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-ink-900/[0.06] pt-3">
                    {t.status !== "Deleted" ? (
                      <div className="flex items-center gap-2">
                        <Toggle checked={t.status === "Active"} onChange={() => toggleTherapistStatus(t.id)} size="sm" />
                        <span className="text-xs font-medium text-ink-700/50">Status</span>
                      </div>
                    ) : <span />}
                    <div className="flex gap-1">
                      <IconBtn icon={<FileBarChart size={14} />} />
                      <IconBtn icon={<Edit2 size={14} />} />
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <CreateTherapistModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={addTherapist} branches={branches} />
    </div>
  );
}

function IconBtn({ icon }: { icon: React.ReactNode }) {
  return <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 transition-colors hover:bg-brand-50 hover:text-brand-600">{icon}</button>;
}

function CreateTherapistModal({
  open, onClose, onCreate, branches,
}: {
  open: boolean; onClose: () => void;
  onCreate: (t: Omit<Therapist, "id" | "createdAt">) => void;
  branches: { id: number; name: string }[];
}) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [designation, setDesignation] = useState("Therapist");
  const [domain, setDomain] = useState("Pediatric OT");
  const [license, setLicense] = useState("");
  const [mode, setMode] = useState<"Single" | "Multiple">("Single");
  const [assignments, setAssignments] = useState<TherapistAssignment[]>([blankAssignment(branches[0]?.id ?? 1, branches[0]?.name ?? "")]);

  function addAssignment() {
    const branch = branches[assignments.length % branches.length];
    setAssignments((a) => [...a, blankAssignment(branch.id, branch.name)]);
  }
  function removeAssignment(idx: number) {
    setAssignments((a) => a.filter((_, i) => i !== idx));
  }
  function updateAssignment(idx: number, patch: Partial<TherapistAssignment>) {
    setAssignments((a) => a.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }
  function updateWindow(aIdx: number, wIdx: number, patch: Partial<SessionWindow>) {
    setAssignments((a) =>
      a.map((x, i) => (i === aIdx ? { ...x, windows: x.windows.map((w, j) => (j === wIdx ? { ...w, ...patch } : w)) } : x))
    );
  }

  function submit() {
    if (!name || !mobile) return;
    onCreate({
      name, mobile, email, gender: "Female", designation, domainSpecialist: domain,
      licenseNumber: license, status: "Active", assignments, avatarColor: "#0d9488",
    });
    onClose();
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Create Therapist"
      subtitle="Provision login credentials and a per-branch schedule."
      width="max-w-4xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Create Therapist</Button></>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Therapist Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Mobile" required value={mobile} onChange={(e) => setMobile(e.target.value)} />
        <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" defaultValue="Bimba@1234" type="text" />
        <Select label="Domain Specialist" required options={["Pediatric OT", "Neuro Physiotherapy", "Speech-Language Pathology", "ABA Specialist", "Special Educator"].map((d) => ({ label: d, value: d }))} value={domain} onChange={(e) => setDomain(e.target.value)} />
        <Select label="Designation" required options={["Therapist", "Senior Therapist", "Lead Therapist", "Consultant Therapist"].map((d) => ({ label: d, value: d }))} value={designation} onChange={(e) => setDesignation(e.target.value)} />
        <Input label="License Number" value={license} onChange={(e) => setLicense(e.target.value)} />
        <Select label="Single / Multiple Branches" required options={[{ label: "Single Branch", value: "Single" }, { label: "Multiple Branches", value: "Multiple" }]} value={mode} onChange={(e) => setMode(e.target.value as "Single" | "Multiple")} />
        <FileDrop label="Photo" />
        <FileDrop label="Signature" />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Branch Assignments &amp; Schedule</div>
        {mode === "Multiple" && (
          <Button variant="outline" size="sm" icon={<Plus size={13} />} onClick={addAssignment}>Add Branch</Button>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-4">
        {(mode === "Single" ? assignments.slice(0, 1) : assignments).map((a, aIdx) => (
          <div key={aIdx} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-ink-900/[0.06]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Select label="Branch" options={branches.map((b) => ({ label: b.name, value: b.name }))} value={a.branchName} onChange={(e) => updateAssignment(aIdx, { branchName: e.target.value })} />
              <Select label="Therapy Service" options={therapyNamesList.map((t) => ({ label: t, value: t }))} value={a.therapyName} onChange={(e) => updateAssignment(aIdx, { therapyName: e.target.value })} />
              <Input label="Joining Date" type="date" value={a.joiningDate.slice(0, 10)} onChange={(e) => updateAssignment(aIdx, { joiningDate: e.target.value })} />
              <Select label="Day Off" options={dayList.map((d) => ({ label: d, value: d }))} value={a.dayOff} onChange={(e) => updateAssignment(aIdx, { dayOff: e.target.value })} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {a.windows.map((w, wIdx) => (
                <div key={w.label} className={cn("rounded-xl p-3 ring-1 ring-inset transition-colors", w.enabled ? "bg-white ring-brand-200" : "bg-white/40 ring-ink-900/[0.06]")}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-800">{w.label}</span>
                    <Toggle checked={w.enabled} onChange={() => updateWindow(aIdx, wIdx, { enabled: !w.enabled })} size="sm" />
                  </div>
                  {w.enabled && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <div className="flex gap-1">
                        <input type="time" value={w.start} onChange={(e) => updateWindow(aIdx, wIdx, { start: e.target.value })} className="h-7 w-full rounded-md bg-slate-50 px-1.5 text-[11px] ring-1 ring-inset ring-ink-900/10 outline-none" />
                        <input type="time" value={w.end} onChange={(e) => updateWindow(aIdx, wIdx, { end: e.target.value })} className="h-7 w-full rounded-md bg-slate-50 px-1.5 text-[11px] ring-1 ring-inset ring-ink-900/10 outline-none" />
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-ink-700/50">
                        ₹<input type="number" value={w.price} onChange={(e) => updateWindow(aIdx, wIdx, { price: Number(e.target.value) })} className="h-7 w-full rounded-md bg-slate-50 px-1.5 text-[11px] ring-1 ring-inset ring-ink-900/10 outline-none" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {mode === "Multiple" && assignments.length > 1 && (
              <button onClick={() => removeAssignment(aIdx)} className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600">
                <Trash2 size={12} /> Remove branch assignment
              </button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
