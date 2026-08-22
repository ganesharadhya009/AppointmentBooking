import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Edit2, Plus, Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar, ViewToggle } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Card, CardBody } from "@/components/ui/Card";
import { directoryApi, ApiError, type PagedResult } from "@/lib/apiClient";
import { motion } from "framer-motion";

const STATUS_LABELS = ["Active", "Inactive", "Deleted"] as const;

interface BranchOption {
  id: string;
  name: string;
}

interface TherapyType {
  id: string;
  name: string;
  photoUrl: string | null;
  status: number;
  branchIds: string[];
}

type ModalState = { mode: "create" } | { mode: "edit"; therapy: TherapyType } | null;

export default function TherapyPage() {
  const [therapies, setTherapies] = useState<TherapyType[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "card">("list");
  const [modalState, setModalState] = useState<ModalState>(null);
  const [branchFilter, setBranchFilter] = useState("");

  const branchNameById = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  async function reload() {
    setLoading(true);
    try {
      const [therapyRes, branchRes] = await Promise.all([
        directoryApi.get<PagedResult<TherapyType>>("/therapy-types", { pageSize: 100 }),
        directoryApi.get<PagedResult<BranchOption>>("/branches", { pageSize: 100 }),
      ]);
      setTherapies(therapyRes.items);
      setBranches(branchRes.items);
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
    () => (branchFilter ? therapies.filter((t) => t.branchIds.includes(branchFilter)) : therapies),
    [therapies, branchFilter]
  );

  async function toggleActive(therapy: TherapyType) {
    const prev = therapies;
    const nextStatus = therapy.status === 0 ? 1 : 0;
    setTherapies((ts) => ts.map((t) => (t.id === therapy.id ? { ...t, status: nextStatus } : t)));
    try {
      await directoryApi.put(`/therapy-types/${therapy.id}`, {
        name: therapy.name,
        photoUrl: therapy.photoUrl,
        branchIds: therapy.branchIds,
        status: nextStatus,
      });
    } catch {
      setTherapies(prev);
    }
  }

  function branchBadges(branchIds: string[]) {
    const names = branchIds.map((id) => branchNameById.get(id) ?? "Unknown");
    const shown = names.slice(0, 2);
    const rest = names.length - shown.length;
    return (
      <div className="flex flex-wrap gap-1">
        {shown.map((n) => (
          <Badge key={n} tone="brand" dot={false}>{n}</Badge>
        ))}
        {rest > 0 && <Badge tone="neutral" dot={false}>+{rest} more</Badge>}
        {names.length === 0 && <span className="text-xs text-ink-700/40">No branches</span>}
      </div>
    );
  }

  const columns: Column<TherapyType>[] = [
    {
      key: "name",
      header: "Therapy",
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
            <Stethoscope size={15} />
          </div>
          <span className="font-semibold text-ink-900">{t.name}</span>
        </div>
      ),
    },
    { key: "branches", header: "Branches", render: (t) => branchBadges(t.branchIds) },
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
        <div className="flex justify-end">
          <button
            onClick={() => setModalState({ mode: "edit", therapy: t })}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"
          >
            <Edit2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Module 05"
        title="Therapy Catalog"
        description="Named therapy services attached to one or more branches and booked against by parents. Deletion is soft — history stays intact."
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModalState({ mode: "create" })}>
            Create Therapy
          </Button>
        }
      />

      <FilterBar>
        <Select
          label="Branch"
          placeholder="All branches"
          options={branches.map((b) => ({ label: b.name, value: b.id }))}
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        />
        <div className="flex items-end lg:col-span-3 lg:justify-end">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </FilterBar>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {view === "list" ? (
        <Card>
          <DataTable
            columns={columns}
            data={filtered}
            searchKeys={["name"]}
            rowKey={(t) => t.id}
            emptyLabel={loading ? "Loading…" : "No therapies yet"}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <Card>
                <CardBody>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white">
                    <Stethoscope size={18} />
                  </div>
                  <h3 className="mt-3 font-bold text-ink-950">{t.name}</h3>
                  <div className="mt-1.5">{branchBadges(t.branchIds)}</div>
                  <div className="mt-3 flex items-center justify-between border-t border-ink-900/[0.06] pt-3">
                    <Badge tone={statusTone(STATUS_LABELS[t.status])}>{STATUS_LABELS[t.status]}</Badge>
                    {t.status !== 2 && <Toggle checked={t.status === 0} onChange={() => toggleActive(t)} size="sm" />}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <TherapyModal state={modalState} onClose={() => setModalState(null)} onSaved={reload} branches={branches} />
    </div>
  );
}

function TherapyModal({
  state, onClose, onSaved, branches,
}: {
  state: ModalState; onClose: () => void; onSaved: () => void; branches: BranchOption[];
}) {
  const editing = state?.mode === "edit" ? state.therapy : null;
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state) return;
    setName(editing?.name ?? "");
    setPhotoUrl(editing?.photoUrl ?? "");
    setBranchIds(editing?.branchIds ?? []);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function toggleBranch(id: string) {
    setBranchIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function submit() {
    if (!name) {
      setError("Therapy name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await directoryApi.put(`/therapy-types/${editing.id}`, {
          name,
          photoUrl: photoUrl || null,
          branchIds,
          status: editing.status,
        });
      } else {
        await directoryApi.post("/therapy-types", { name, photoUrl: photoUrl || null, branchIds });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this therapy.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={editing ? "Edit Therapy" : "Create Therapy"}
      subtitle={editing ? "Update this therapy's details and branch coverage." : "Add a new therapy type and the branches that offer it."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create"}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Therapy Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Occupational Therapy" />
        <Input label="Photo URL" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-ink-700">Branches</label>
          <p className="mt-0.5 text-[11px] text-ink-700/50">Select every branch that offers this therapy.</p>
          <div className="mt-1.5 flex max-h-44 flex-col gap-1.5 overflow-y-auto rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-ink-900/10">
            {branches.length === 0 && <span className="text-xs text-ink-700/40">No branches yet — create one first.</span>}
            {branches.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-sm text-ink-800">
                <input
                  type="checkbox"
                  checked={branchIds.includes(b.id)}
                  onChange={() => toggleBranch(b.id)}
                  className="h-3.5 w-3.5 rounded accent-brand-600"
                />
                {b.name}
              </label>
            ))}
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </Modal>
  );
}
