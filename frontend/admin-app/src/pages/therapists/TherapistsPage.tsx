import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Edit2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar, ViewToggle } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Card, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { directoryApi, ApiError, type PagedResult } from "@/lib/apiClient";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Matches DirectoryApi.Entities.TherapistStatus / SessionWindowName / System.DayOfWeek exactly --
// the backend serializes each as its numeric ordinal.
const STATUS_LABELS = ["Active", "Inactive", "Deleted"];
const WINDOW_LABELS = ["Morning", "Noon", "Afternoon", "Evening"] as const;
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DESIGNATION_OPTIONS = ["Therapist", "Senior Therapist", "Lead Therapist", "Consultant Therapist"];
const GENDER_OPTIONS = ["Male", "Female", "Other"];

interface BranchOption {
  id: string;
  name: string;
}

interface TherapyTypeOption {
  id: string;
  name: string;
  branchIds: string[];
}

interface SessionWindow {
  windowName: number;
  startTime: string;
  endTime: string;
  pricePerSession: number;
}

interface Assignment {
  id: string;
  branchId: string;
  therapyTypeId: string;
  joiningDate: string;
  weeklyDayOff: number;
  lunchBreakStart: string | null;
  lunchBreakEnd: string | null;
  sessionWindows: SessionWindow[];
}

interface Therapist {
  id: string;
  name: string;
  mobileNumber: string;
  email: string;
  licenseNumber: string;
  gender: string | null;
  designation: string;
  photoUrl: string | null;
  certificateUrl: string | null;
  signatureUrl: string | null;
  status: number;
  assignments: Assignment[];
}

export default function TherapistsPage() {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [therapyTypes, setTherapyTypes] = useState<TherapyTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "card">("list");
  const [modalState, setModalState] = useState<{ mode: "create" } | { mode: "edit"; therapist: Therapist } | null>(null);
  const [branchFilter, setBranchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const branchNameById = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);
  const therapyNameById = useMemo(() => new Map(therapyTypes.map((t) => [t.id, t.name])), [therapyTypes]);

  async function reload() {
    setLoading(true);
    try {
      const [therapistRes, branchRes, therapyRes] = await Promise.all([
        directoryApi.get<PagedResult<Therapist>>("/therapists", { pageSize: 100 }),
        directoryApi.get<PagedResult<BranchOption>>("/branches", { pageSize: 100 }),
        directoryApi.get<PagedResult<TherapyTypeOption>>("/therapy-types", { pageSize: 100 }),
      ]);
      setTherapists(therapistRes.items);
      setBranches(branchRes.items);
      setTherapyTypes(therapyRes.items);
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
    () =>
      therapists.filter(
        (t) =>
          (!branchFilter || t.assignments.some((a) => a.branchId === branchFilter)) &&
          (!statusFilter || STATUS_LABELS[t.status] === statusFilter)
      ),
    [therapists, branchFilter, statusFilter]
  );

  async function toggleActive(therapist: Therapist) {
    try {
      await directoryApi.put(`/therapists/${therapist.id}`, therapistToBody(therapist, therapist.status === 0 ? 1 : 0));
      reload();
    } catch {
      // reload on next action will reflect true server state
    }
  }

  function branchTherapyBadges(assignments: Assignment[]) {
    const shown = assignments.slice(0, 2);
    const rest = assignments.length - shown.length;
    return (
      <div className="flex flex-wrap gap-1">
        {shown.map((a) => (
          <span key={a.id} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
            {branchNameById.get(a.branchId) ?? "Unknown"}
          </span>
        ))}
        {rest > 0 && <span className="text-[11px] text-ink-700/40">+{rest} more</span>}
        {assignments.length === 0 && <span className="text-xs text-ink-700/40">No assignments</span>}
      </div>
    );
  }

  const columns: Column<Therapist>[] = [
    {
      key: "name",
      header: "Therapist",
      render: (t) => (
        <div className="flex items-center gap-3">
          <Avatar name={t.name} color="#0d9488" size={34} photoUrl={t.photoUrl ?? undefined} />
          <div>
            <div className="font-semibold text-ink-900">{t.name}</div>
            <div className="text-xs text-ink-700/45">{t.designation}</div>
          </div>
        </div>
      ),
    },
    { key: "mobile", header: "Contact", render: (t) => t.mobileNumber },
    { key: "branches", header: "Branch / Therapy", render: (t) => branchTherapyBadges(t.assignments) },
    {
      key: "status",
      header: "Status",
      render: (t) => (
        <div className="flex items-center gap-2">
          {t.status !== 2 && <Toggle checked={t.status === 0} onChange={() => toggleActive(t)} size="sm" />}
          <Badge tone={statusTone(STATUS_LABELS[t.status])}>{STATUS_LABELS[t.status]}</Badge>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (t) => (
        <button
          onClick={() => setModalState({ mode: "edit", therapist: t })}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"
        >
          <Edit2 size={14} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Module 06"
        title="Multi-Therapist Management"
        description="Therapist onboarding, credentials, and per-branch session-window scheduling with independent pricing."
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModalState({ mode: "create" })} disabled={branches.length === 0}>
            Create Therapist
          </Button>
        }
      />

      <FilterBar>
        <Select label="Branch" placeholder="All branches" options={branches.map((b) => ({ label: b.name, value: b.id }))} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} />
        <Select
          label="Status"
          placeholder="All statuses"
          options={STATUS_LABELS.map((label) => ({ label, value: label }))}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
        <div className="flex items-end lg:col-span-2 lg:justify-end">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </FilterBar>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}
      {branches.length === 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
          Add at least one Branch before creating a therapist.
        </div>
      )}

      {view === "list" ? (
        <Card>
          <DataTable columns={columns} data={filtered} searchKeys={["name", "mobileNumber", "designation"]} rowKey={(t) => t.id} emptyLabel={loading ? "Loading…" : "No therapists yet"} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <Avatar name={t.name} color="#0d9488" size={44} photoUrl={t.photoUrl ?? undefined} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-ink-950">{t.name}</h3>
                      <p className="truncate text-xs text-ink-700/50">{t.designation}</p>
                    </div>
                    <Badge tone={statusTone(STATUS_LABELS[t.status])}>{STATUS_LABELS[t.status]}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.assignments.map((a) => (
                      <span key={a.id} className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
                        {branchNameById.get(a.branchId) ?? "Unknown"} &middot; {therapyNameById.get(a.therapyTypeId) ?? "Unknown"}
                      </span>
                    ))}
                    {t.assignments.length === 0 && <span className="text-xs text-ink-700/40">No assignments</span>}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-ink-900/[0.06] pt-3">
                    {t.status !== 2 ? (
                      <div className="flex items-center gap-2">
                        <Toggle checked={t.status === 0} onChange={() => toggleActive(t)} size="sm" />
                        <span className="text-xs font-medium text-ink-700/50">Status</span>
                      </div>
                    ) : <span />}
                    <button
                      onClick={() => setModalState({ mode: "edit", therapist: t })}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <TherapistModal state={modalState} onClose={() => setModalState(null)} onSaved={reload} branches={branches} therapyTypes={therapyTypes} />
    </div>
  );
}

function therapistToBody(t: Therapist, status: number) {
  return {
    name: t.name,
    mobileNumber: t.mobileNumber,
    email: t.email,
    licenseNumber: t.licenseNumber,
    gender: t.gender,
    designation: t.designation,
    photoUrl: t.photoUrl,
    certificateUrl: t.certificateUrl,
    signatureUrl: t.signatureUrl,
    status,
    assignments: t.assignments.map((a) => ({
      branchId: a.branchId,
      therapyTypeId: a.therapyTypeId,
      joiningDate: a.joiningDate,
      weeklyDayOff: a.weeklyDayOff,
      lunchBreakStart: a.lunchBreakStart,
      lunchBreakEnd: a.lunchBreakEnd,
      sessionWindows: a.sessionWindows,
    })),
  };
}

interface WindowFormState {
  enabled: boolean;
  startTime: string;
  endTime: string;
  price: string;
}

interface AssignmentFormState {
  branchId: string;
  therapyTypeId: string;
  joiningDate: string;
  weeklyDayOff: number;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  windows: WindowFormState[];
}

function blankWindows(): WindowFormState[] {
  return WINDOW_LABELS.map((_, i) => ({ enabled: i === 0, startTime: "09:00", endTime: "12:00", price: "500" }));
}

function blankAssignment(branchId: string): AssignmentFormState {
  return {
    branchId,
    therapyTypeId: "",
    joiningDate: new Date().toISOString().slice(0, 10),
    weeklyDayOff: 0,
    lunchBreakStart: "",
    lunchBreakEnd: "",
    windows: blankWindows(),
  };
}

function TherapistModal({
  state, onClose, onSaved, branches, therapyTypes,
}: {
  state: { mode: "create" } | { mode: "edit"; therapist: Therapist } | null;
  onClose: () => void;
  onSaved: () => void;
  branches: BranchOption[];
  therapyTypes: TherapyTypeOption[];
}) {
  const editing = state?.mode === "edit" ? state.therapist : null;
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [designation, setDesignation] = useState(DESIGNATION_OPTIONS[0]);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [certificateUrl, setCertificateUrl] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [mode, setMode] = useState<"Single" | "Multiple">("Single");
  const [assignments, setAssignments] = useState<AssignmentFormState[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state) return;
    setName(editing?.name ?? "");
    setMobile(editing?.mobileNumber ?? "");
    setEmail(editing?.email ?? "");
    setGender(editing?.gender ?? "");
    setDesignation(editing?.designation ?? DESIGNATION_OPTIONS[0]);
    setLicenseNumber(editing?.licenseNumber ?? "");
    setPhotoUrl(editing?.photoUrl ?? "");
    setCertificateUrl(editing?.certificateUrl ?? "");
    setSignatureUrl(editing?.signatureUrl ?? "");
    if (editing && editing.assignments.length > 0) {
      setMode(editing.assignments.length > 1 ? "Multiple" : "Single");
      setAssignments(
        editing.assignments.map((a) => {
          const byName = new Map(a.sessionWindows.map((w) => [w.windowName, w]));
          return {
            branchId: a.branchId,
            therapyTypeId: a.therapyTypeId,
            joiningDate: a.joiningDate.slice(0, 10),
            weeklyDayOff: a.weeklyDayOff,
            lunchBreakStart: a.lunchBreakStart?.slice(0, 5) ?? "",
            lunchBreakEnd: a.lunchBreakEnd?.slice(0, 5) ?? "",
            windows: WINDOW_LABELS.map((_, i) => {
              const w = byName.get(i);
              return w
                ? { enabled: true, startTime: w.startTime.slice(0, 5), endTime: w.endTime.slice(0, 5), price: String(w.pricePerSession) }
                : { enabled: false, startTime: "09:00", endTime: "12:00", price: "500" };
            }),
          };
        })
      );
    } else {
      setMode("Single");
      setAssignments(branches[0] ? [blankAssignment(branches[0].id)] : []);
    }
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function addAssignment() {
    const branch = branches[assignments.length % branches.length];
    if (!branch) return;
    setAssignments((a) => [...a, blankAssignment(branch.id)]);
  }
  function removeAssignment(idx: number) {
    setAssignments((a) => a.filter((_, i) => i !== idx));
  }
  function updateAssignment(idx: number, patch: Partial<AssignmentFormState>) {
    setAssignments((a) => a.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }
  function updateWindow(aIdx: number, wIdx: number, patch: Partial<WindowFormState>) {
    setAssignments((a) =>
      a.map((x, i) => (i === aIdx ? { ...x, windows: x.windows.map((w, j) => (j === wIdx ? { ...w, ...patch } : w)) } : x))
    );
  }

  const activeAssignments = mode === "Single" ? assignments.slice(0, 1) : assignments;

  async function submit() {
    if (!name || !mobile || !email || !licenseNumber) {
      setError("Name, mobile, email and license number are all required.");
      return;
    }
    if (activeAssignments.length === 0) {
      setError("A therapist must have at least one branch assignment.");
      return;
    }
    for (const a of activeAssignments) {
      if (!a.branchId || !a.therapyTypeId) {
        setError("Every assignment needs a branch and a therapy service.");
        return;
      }
      const enabled = a.windows.filter((w) => w.enabled);
      if (enabled.length === 0) {
        setError("Every assignment needs at least one enabled session window.");
        return;
      }
      for (const w of enabled) {
        if (w.endTime <= w.startTime) {
          setError("A session window's end time must be after its start time.");
          return;
        }
      }
      if ((a.lunchBreakStart && !a.lunchBreakEnd) || (!a.lunchBreakStart && a.lunchBreakEnd)) {
        setError("A lunch break needs both a start and an end time.");
        return;
      }
    }

    setSaving(true);
    setError("");
    const body = {
      name,
      mobileNumber: mobile,
      email,
      licenseNumber,
      gender: gender || null,
      designation,
      photoUrl: photoUrl || null,
      certificateUrl: certificateUrl || null,
      signatureUrl: signatureUrl || null,
      assignments: activeAssignments.map((a) => ({
        branchId: a.branchId,
        therapyTypeId: a.therapyTypeId,
        joiningDate: a.joiningDate,
        weeklyDayOff: a.weeklyDayOff,
        lunchBreakStart: a.lunchBreakStart ? `${a.lunchBreakStart}:00` : null,
        lunchBreakEnd: a.lunchBreakEnd ? `${a.lunchBreakEnd}:00` : null,
        sessionWindows: a.windows
          .map((w, i) => ({ windowName: i, startTime: `${w.startTime}:00`, endTime: `${w.endTime}:00`, pricePerSession: Number(w.price) || 0, enabled: w.enabled }))
          .filter((w) => w.enabled)
          .map(({ enabled: _enabled, ...rest }) => rest),
      })),
    };
    try {
      if (editing) {
        await directoryApi.put(`/therapists/${editing.id}`, { ...body, status: editing.status });
      } else {
        await directoryApi.post("/therapists", body);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this therapist.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={editing ? "Edit Therapist" : "Create Therapist"}
      subtitle="Onboard a therapist and their per-branch schedule."
      width="max-w-4xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Therapist"}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Therapist Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Mobile" required value={mobile} onChange={(e) => setMobile(e.target.value)} />
        <Input label="Email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Select label="Gender" placeholder="Not specified" options={GENDER_OPTIONS.map((g) => ({ label: g, value: g }))} value={gender} onChange={(e) => setGender(e.target.value)} />
        <Select label="Designation" required options={DESIGNATION_OPTIONS.map((d) => ({ label: d, value: d }))} value={designation} onChange={(e) => setDesignation(e.target.value)} />
        <Input label="License Number" required value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
        <Select label="Single / Multiple Branches" required options={[{ label: "Single Branch", value: "Single" }, { label: "Multiple Branches", value: "Multiple" }]} value={mode} onChange={(e) => setMode(e.target.value as "Single" | "Multiple")} />
        <Input label="Photo URL" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
        <Input label="Certificate URL" value={certificateUrl} onChange={(e) => setCertificateUrl(e.target.value)} placeholder="https://…" />
        <Input label="Signature URL" value={signatureUrl} onChange={(e) => setSignatureUrl(e.target.value)} placeholder="https://…" />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Branch Assignments &amp; Schedule</div>
        {mode === "Multiple" && (
          <Button variant="outline" size="sm" icon={<Plus size={13} />} onClick={addAssignment} disabled={branches.length === 0}>Add Branch</Button>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-4">
        {activeAssignments.map((a, aIdx) => {
          const availableTherapies = therapyTypes.filter((t) => t.branchIds.includes(a.branchId));
          return (
            <div key={aIdx} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-ink-900/[0.06]">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Select
                  label="Branch"
                  options={branches.map((b) => ({ label: b.name, value: b.id }))}
                  value={a.branchId}
                  onChange={(e) => updateAssignment(aIdx, { branchId: e.target.value, therapyTypeId: "" })}
                />
                <Select
                  label="Therapy Service"
                  placeholder={availableTherapies.length === 0 ? "No therapies at this branch" : "Select therapy"}
                  options={availableTherapies.map((t) => ({ label: t.name, value: t.id }))}
                  value={a.therapyTypeId}
                  onChange={(e) => updateAssignment(aIdx, { therapyTypeId: e.target.value })}
                />
                <Input label="Joining Date" type="date" value={a.joiningDate} onChange={(e) => updateAssignment(aIdx, { joiningDate: e.target.value })} />
                <Select
                  label="Day Off"
                  options={DAY_LABELS.map((label, i) => ({ label, value: String(i) }))}
                  value={String(a.weeklyDayOff)}
                  onChange={(e) => updateAssignment(aIdx, { weeklyDayOff: Number(e.target.value) })}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Input label="Lunch Break Start" type="time" value={a.lunchBreakStart} onChange={(e) => updateAssignment(aIdx, { lunchBreakStart: e.target.value })} />
                <Input label="Lunch Break End" type="time" value={a.lunchBreakEnd} onChange={(e) => updateAssignment(aIdx, { lunchBreakEnd: e.target.value })} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {a.windows.map((w, wIdx) => (
                  <div key={WINDOW_LABELS[wIdx]} className={cn("rounded-xl p-3 ring-1 ring-inset transition-colors", w.enabled ? "bg-white ring-brand-200" : "bg-white/40 ring-ink-900/[0.06]")}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink-800">{WINDOW_LABELS[wIdx]}</span>
                      <Toggle checked={w.enabled} onChange={() => updateWindow(aIdx, wIdx, { enabled: !w.enabled })} size="sm" />
                    </div>
                    {w.enabled && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <div className="flex gap-1">
                          <input type="time" value={w.startTime} onChange={(e) => updateWindow(aIdx, wIdx, { startTime: e.target.value })} className="h-7 w-full rounded-md bg-slate-50 px-1.5 text-[11px] ring-1 ring-inset ring-ink-900/10 outline-none" />
                          <input type="time" value={w.endTime} onChange={(e) => updateWindow(aIdx, wIdx, { endTime: e.target.value })} className="h-7 w-full rounded-md bg-slate-50 px-1.5 text-[11px] ring-1 ring-inset ring-ink-900/10 outline-none" />
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-ink-700/50">
                          ₹<input type="number" value={w.price} onChange={(e) => updateWindow(aIdx, wIdx, { price: e.target.value })} className="h-7 w-full rounded-md bg-slate-50 px-1.5 text-[11px] ring-1 ring-inset ring-ink-900/10 outline-none" />
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
          );
        })}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </Modal>
  );
}
