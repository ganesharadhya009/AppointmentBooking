import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Baby, Edit2, FileBarChart, Plus, Upload, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Badge, statusTone } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar, ViewToggle } from "@/components/ui/FilterBar";
import { Card, CardBody } from "@/components/ui/Card";
import { Input, Select, FileDrop } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { clientRecordsApi, ApiError, type PagedResult } from "@/lib/apiClient";
import { computeAge, formatDate } from "@/lib/utils";
import { motion } from "framer-motion";

// ClientStatus matches ClientRecordsApi.Entities.ClientStatus exactly (Active=0, Inactive=1).
const STATUS_LABELS = ["Active", "Inactive"];
const GENDER_OPTIONS = ["Male", "Female", "Other"];

interface Parent {
  id: string;
  name: string;
  mobileNumber: string;
  email: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  status: number;
}

interface Child {
  id: string;
  parentId: string;
  name: string;
  dateOfBirth: string;
  gender: string | null;
  guardianName: string | null;
  status: number;
}

type ChildModalState = { mode: "create"; parentId?: string } | { mode: "edit"; child: Child } | null;

export default function ClientsPage() {
  const [tab, setTab] = useState("parents");
  const [view, setView] = useState<"list" | "card">("list");
  const [parents, setParents] = useState<Parent[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const [parentRes, childRes] = await Promise.all([
        clientRecordsApi.get<PagedResult<Parent>>("/parents", { pageSize: 100 }),
        clientRecordsApi.get<PagedResult<Child>>("/children", { pageSize: 100 }),
      ]);
      setParents(parentRes.items);
      setChildren(childRes.items);
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach client-records-api.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Records · Module 13"
        title="Clients & Children"
        description="Parents and their children — the core customer record — with bulk onboarding support."
        actions={tab !== "import" ? <ViewToggle view={view} onChange={setView} /> : undefined}
      />

      <div className="mb-5">
        <Tabs
          items={[
            { key: "parents", label: "Parents", count: parents.length },
            { key: "children", label: "Children", count: children.length },
            { key: "import", label: "Bulk Import" },
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

      {tab === "parents" && <ParentsTab parents={parents} children={children} loading={loading} view={view} onReload={reload} />}
      {tab === "children" && <ChildrenTab children={children} parents={parents} loading={loading} view={view} onReload={reload} />}
      {tab === "import" && <BulkImport />}
    </div>
  );
}

function childCount(parentId: string, children: Child[]) {
  return children.filter((c) => c.parentId === parentId).length;
}

function ParentsTab({
  parents, children, loading, view, onReload,
}: { parents: Parent[]; children: Child[]; loading: boolean; view: "list" | "card"; onReload: () => void }) {
  const [editing, setEditing] = useState<Parent | null>(null);
  const [childModal, setChildModal] = useState<ChildModalState>(null);

  const columns: Column<Parent>[] = [
    {
      key: "name",
      header: "Parent",
      render: (p) => (
        <div className="flex items-center gap-3">
          <Avatar name={p.name} color="#4f46e5" size={32} />
          <div>
            <div className="font-semibold text-ink-900">{p.name}</div>
            <div className="text-xs text-ink-700/45">{p.email}</div>
          </div>
        </div>
      ),
    },
    { key: "contact", header: "Contact", render: (p) => p.mobileNumber },
    { key: "address", header: "Address", render: (p) => <span className="text-ink-700/60">{[p.address, p.city].filter(Boolean).join(", ") || "—"}</span> },
    { key: "children", header: "Children", align: "center", render: (p) => <Badge tone="brand">{childCount(p.id, children)}</Badge> },
    { key: "status", header: "Status", render: (p) => <Badge tone={statusTone(STATUS_LABELS[p.status])}>{STATUS_LABELS[p.status]}</Badge> },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1">
          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><FileBarChart size={14} /></button>
          <button onClick={() => setEditing(p)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><Edit2 size={14} /></button>
          <button onClick={() => setChildModal({ mode: "create", parentId: p.id })} title="Add child" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-teal-50 hover:text-teal-600"><Baby size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <>
      <FilterBar onExport={() => alert("Exporting parent list...")}>
        <Input label="Sign-up From" type="date" />
        <Input label="Sign-up To" type="date" />
        <Input label="Contact Number" placeholder="Search by phone" />
      </FilterBar>

      {view === "list" ? (
        <Card><DataTable columns={columns} data={parents} searchKeys={["name", "mobileNumber", "email"]} rowKey={(p) => p.id} emptyLabel={loading ? "Loading…" : "No parents yet"} /></Card>
      ) : parents.length === 0 && !loading ? (
        <Card><CardBody className="text-center text-sm text-ink-700/50">No parents yet.</CardBody></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {parents.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <Card>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} color="#0d9488" size={40} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-ink-950">{p.name}</h3>
                      <p className="truncate text-xs text-ink-700/45">{p.mobileNumber}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <div className="flex-1 rounded-lg bg-slate-50 px-2.5 py-2 text-center">
                      <div className="text-sm font-extrabold text-ink-950">{childCount(p.id, children)}</div>
                      <div className="text-[10px] text-ink-700/45">Children</div>
                    </div>
                    <div className="flex-1 rounded-lg bg-slate-50 px-2.5 py-2 text-center">
                      <div className="text-sm font-extrabold text-ink-950">{STATUS_LABELS[p.status]}</div>
                      <div className="text-[10px] text-ink-700/45">Status</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-1 border-t border-ink-900/[0.06] pt-3">
                    <button onClick={() => setEditing(p)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><Edit2 size={14} /></button>
                    <button onClick={() => setChildModal({ mode: "create", parentId: p.id })} title="Add child" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-teal-50 hover:text-teal-600"><Baby size={14} /></button>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <ParentEditModal parent={editing} onClose={() => setEditing(null)} onSaved={onReload} />
      <ChildFormModal state={childModal} parents={parents} onClose={() => setChildModal(null)} onSaved={onReload} />
    </>
  );
}

function ParentEditModal({ parent, onClose, onSaved }: { parent: Parent | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!parent) return;
    setName(parent.name);
    setMobileNumber(parent.mobileNumber);
    setEmail(parent.email);
    setAddress(parent.address ?? "");
    setCity(parent.city ?? "");
    setState(parent.state ?? "");
    setCountry(parent.country ?? "");
    setStatus(String(parent.status));
    setError("");
  }, [parent]);

  async function submit() {
    if (!parent) return;
    if (!name || !mobileNumber || !email) {
      setError("Name, contact and email are all required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await clientRecordsApi.put(`/parents/${parent.id}`, {
        name, mobileNumber, email,
        address: address || null, city: city || null, state: state || null, country: country || null,
        status: Number(status),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this parent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!parent}
      onClose={onClose}
      title="Edit Parent"
      subtitle="Update this family's contact record."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button></>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Contact Number" required value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} />
        <Input label="Email" required type="email" className="sm:col-span-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Address" className="sm:col-span-2" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <Input label="State" value={state} onChange={(e) => setState(e.target.value)} />
        <Input label="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
        <Select label="Status" options={STATUS_LABELS.map((label, i) => ({ label, value: String(i) }))} value={status} onChange={(e) => setStatus(e.target.value)} />
      </div>
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </Modal>
  );
}

function ChildrenTab({
  children, parents, loading, view, onReload,
}: { children: Child[]; parents: Parent[]; loading: boolean; view: "list" | "card"; onReload: () => void }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [childModal, setChildModal] = useState<ChildModalState>(null);
  const parentNameById = useMemo(() => new Map(parents.map((p) => [p.id, p.name])), [parents]);

  const filtered = useMemo(
    () => children.filter((c) => !statusFilter || STATUS_LABELS[c.status] === statusFilter),
    [children, statusFilter]
  );

  const columns: Column<Child>[] = [
    { key: "name", header: "Child", render: (c) => <span className="font-semibold text-ink-900">{c.name}</span> },
    { key: "dob", header: "DOB (Age)", render: (c) => `${formatDate(c.dateOfBirth)} (${computeAge(c.dateOfBirth)}y)` },
    { key: "guardian", header: "Guardian", render: (c) => c.guardianName ?? "—" },
    { key: "parent", header: "Parent", render: (c) => parentNameById.get(c.parentId) ?? "Unknown" },
    { key: "status", header: "Status", render: (c) => <Badge tone={statusTone(STATUS_LABELS[c.status])}>{STATUS_LABELS[c.status]}</Badge> },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (c) => (
        <button onClick={() => setChildModal({ mode: "edit", child: c })} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><Edit2 size={14} /></button>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setChildModal({ mode: "create" })} disabled={parents.length === 0}>
          Add Child
        </Button>
      </div>
      {parents.length === 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
          Add at least one Parent before adding a child.
        </div>
      )}
      <FilterBar>
        <Select label="Status" placeholder="All statuses" options={STATUS_LABELS.map((s) => ({ label: s, value: s }))} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
        <Input label="From Date" type="date" />
        <Input label="To Date" type="date" />
      </FilterBar>

      {view === "list" ? (
        <Card><DataTable columns={columns} data={filtered} searchKeys={["name", "guardianName"]} rowKey={(c) => c.id} emptyLabel={loading ? "Loading…" : "No children yet"} /></Card>
      ) : filtered.length === 0 && !loading ? (
        <Card><CardBody className="text-center text-sm text-ink-700/50">No children yet.</CardBody></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <Card>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <Avatar name={c.name} color="#f59e0b" size={40} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-ink-950">{c.name}</h3>
                      <p className="text-xs text-ink-700/45">{computeAge(c.dateOfBirth)} yrs &middot; {c.guardianName ?? "—"}</p>
                    </div>
                    <Badge tone={statusTone(STATUS_LABELS[c.status])}>{STATUS_LABELS[c.status]}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-ink-900/[0.06] pt-3">
                    <span className="text-[11px] text-ink-700/45">Parent: {parentNameById.get(c.parentId) ?? "Unknown"}</span>
                    <button onClick={() => setChildModal({ mode: "edit", child: c })} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><Edit2 size={13} /></button>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <ChildFormModal state={childModal} parents={parents} onClose={() => setChildModal(null)} onSaved={onReload} />
    </>
  );
}

function ChildFormModal({
  state, parents, onClose, onSaved,
}: { state: ChildModalState; parents: Parent[]; onClose: () => void; onSaved: () => void }) {
  const editing = state?.mode === "edit" ? state.child : null;
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [parentId, setParentId] = useState("");
  const [status, setStatus] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state) return;
    setName(editing?.name ?? "");
    setDob(editing?.dateOfBirth.slice(0, 10) ?? "");
    setGender(editing?.gender ?? "");
    setGuardianName(editing?.guardianName ?? "");
    setParentId(editing?.parentId ?? (state.mode === "create" ? (state.parentId ?? "") : ""));
    setStatus(editing ? String(editing.status) : "0");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function submit() {
    if (!name || !dob || !parentId) {
      setError("Name, date of birth and parent are all required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        parentId, name, dateOfBirth: dob,
        gender: gender || null, guardianName: guardianName || null,
      };
      if (editing) {
        await clientRecordsApi.put(`/children/${editing.id}`, { ...body, status: Number(status) });
      } else {
        await clientRecordsApi.post("/children", body);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this child.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={editing ? "Edit Child" : "Add Child"}
      subtitle={editing ? "Update this child's record." : "Add a child to a parent's family record."}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Child"}</Button></>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Parent" required placeholder="Select parent" options={parents.map((p) => ({ label: p.name, value: p.id }))} value={parentId} onChange={(e) => setParentId(e.target.value)} />
        <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Date of Birth" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} />
        <Select label="Gender" placeholder="Not specified" options={GENDER_OPTIONS.map((g) => ({ label: g, value: g }))} value={gender} onChange={(e) => setGender(e.target.value)} />
        <Input label="Guardian Name" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
        {editing && <Select label="Status" options={STATUS_LABELS.map((label, i) => ({ label, value: String(i) }))} value={status} onChange={(e) => setStatus(e.target.value)} />}
      </div>
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </Modal>
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
