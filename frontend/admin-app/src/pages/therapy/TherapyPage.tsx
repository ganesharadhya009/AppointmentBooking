import { useMemo, useState } from "react";
import { Edit2, Plus, Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar, ViewToggle } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, FileDrop } from "@/components/ui/Field";
import { Card, CardBody } from "@/components/ui/Card";
import { useAppStore } from "@/store/appStore";
import type { Therapy } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { motion } from "framer-motion";

export default function TherapyPage() {
  const { therapies, branches, toggleTherapyStatus, addTherapy } = useAppStore();
  const [view, setView] = useState<"list" | "card">("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");

  const filtered = useMemo(
    () => therapies.filter((t) => !branchFilter || t.branchName === branchFilter),
    [therapies, branchFilter]
  );

  const columns: Column<Therapy>[] = [
    { key: "id", header: "ID", render: (t) => <span className="text-ink-700/40">#{t.id}</span>, width: "70px" },
    {
      key: "name",
      header: "Therapy",
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: t.imageColor }}>
            <Stethoscope size={15} />
          </div>
          <span className="font-semibold text-ink-900">{t.name}</span>
        </div>
      ),
    },
    { key: "branch", header: "Branch", render: (t) => t.branchName },
    { key: "createdBy", header: "Created By", render: (t) => <span className="text-ink-700/60">{t.createdBy}</span> },
    { key: "createdAt", header: "Created On", render: (t) => <span className="text-ink-700/50">{formatDate(t.createdAt)}</span> },
    {
      key: "status", header: "Status", render: (t) => (
        <div className="flex items-center gap-2">
          {t.status !== "Deleted" && <Toggle checked={t.status === "Active"} onChange={() => toggleTherapyStatus(t.id)} size="sm" />}
          <Badge tone={statusTone(t.status)}>{t.status}</Badge>
        </div>
      )
    },
    { key: "action", header: "Action", align: "right", render: () => (
      <div className="flex justify-end">
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600">
          <Edit2 size={14} />
        </button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Module 05"
        title="Therapy Catalog"
        description="Named therapy services attached to branches and booked against by parents. Deletion is soft — history stays intact."
        actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Create Therapy</Button>}
      />

      <FilterBar>
        <Select label="Branch" placeholder="All branches" options={branches.map((b) => ({ label: b.name, value: b.name }))} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} />
        <div className="flex items-end lg:col-span-3 lg:justify-end">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </FilterBar>

      {view === "list" ? (
        <Card>
          <DataTable columns={columns} data={filtered} searchKeys={["name", "branchName"]} rowKey={(t) => t.id} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <Card>
                <CardBody>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: t.imageColor }}>
                    <Stethoscope size={18} />
                  </div>
                  <h3 className="mt-3 font-bold text-ink-950">{t.name}</h3>
                  <p className="text-xs text-ink-700/50">{t.branchName}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-ink-900/[0.06] pt-3">
                    <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                    {t.status !== "Deleted" && <Toggle checked={t.status === "Active"} onChange={() => toggleTherapyStatus(t.id)} size="sm" />}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <CreateTherapyModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={addTherapy} branches={branches} />
    </div>
  );
}

function CreateTherapyModal({
  open, onClose, onCreate, branches,
}: {
  open: boolean; onClose: () => void;
  onCreate: (t: Omit<Therapy, "id" | "createdAt" | "createdBy">) => void;
  branches: { id: number; name: string }[];
}) {
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState("");

  function submit() {
    const branch = branches.find((b) => String(b.id) === branchId);
    if (!name || !branch) return;
    onCreate({ name, branchId: branch.id, branchName: branch.name, status: "Active", imageColor: "#0d9488" });
    onClose();
    setName(""); setBranchId("");
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Create Therapy"
      subtitle="Add a new therapy type to a branch's service catalog."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Create</Button></>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Therapy Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Occupational Therapy" />
        <Select label="Branch" required placeholder="Select branch" options={branches.map((b) => ({ label: b.name, value: String(b.id) }))} value={branchId} onChange={(e) => setBranchId(e.target.value)} />
        <FileDrop label="Illustrative Photo" />
      </div>
    </Modal>
  );
}
