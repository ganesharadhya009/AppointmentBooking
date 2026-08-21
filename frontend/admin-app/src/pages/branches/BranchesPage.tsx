import { useMemo, useState } from "react";
import { Building2, Edit2, ListTree, MapPin, Phone, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar, ViewToggle } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea, FileDrop } from "@/components/ui/Field";
import { Card, CardBody } from "@/components/ui/Card";
import { useAppStore } from "@/store/appStore";
import type { Branch } from "@/lib/types";
import { dayList } from "@/lib/mockData";
import { motion } from "framer-motion";

const tierDefaults = [10, 24, 48, 72, 96];

export default function BranchesPage() {
  const { branches, toggleBranchStatus, addBranch } = useAppStore();
  const [view, setView] = useState<"list" | "card">("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(
    () =>
      branches.filter(
        (b) => (!cityFilter || b.city === cityFilter) && (!statusFilter || b.status === statusFilter)
      ),
    [branches, cityFilter, statusFilter]
  );

  const columns: Column<Branch>[] = [
    { key: "id", header: "ID", render: (b) => <span className="text-ink-700/40">#{b.id}</span>, width: "70px" },
    {
      key: "name",
      header: "Branch",
      render: (b) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: b.imageColor }}>
            {b.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-ink-900">{b.name}</div>
            <div className="text-xs text-ink-700/45">{b.location}</div>
          </div>
        </div>
      ),
    },
    { key: "city", header: "Location", render: (b) => <span>{b.city}, {b.state}</span> },
    { key: "lead", header: "Contact Name", render: (b) => <span>{b.leadName} ({b.leadContact})</span> },
    { key: "status", header: "Status", render: (b) => (
      <div className="flex items-center gap-2">
        <Toggle checked={b.status === "Active"} onChange={() => toggleBranchStatus(b.id)} size="sm" />
        <Badge tone={statusTone(b.status)}>{b.status}</Badge>
      </div>
    ) },
    { key: "action", header: "Action", align: "right", render: () => (
      <div className="flex justify-end gap-1">
        <IconBtn icon={<ListTree size={14} />} />
        <IconBtn icon={<Edit2 size={14} />} />
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Module 04"
        title="Branch Management"
        description="Physical therapy centres that scope therapy, therapist, appointment and holiday data across the network."
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
            Create Branch
          </Button>
        }
      />

      <FilterBar onExport={() => alert("Exporting branch cost report...")}>
        <Select label="City" placeholder="All cities" options={[...new Set(branches.map((b) => b.city))].map((c) => ({ label: c, value: c }))} value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
        <Select label="Status" placeholder="All statuses" options={[{ label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
        <div className="flex items-end lg:col-span-2 lg:justify-end">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </FilterBar>

      {view === "list" ? (
        <Card>
          <DataTable columns={columns} data={filtered} searchKeys={["name", "city", "leadName"]} rowKey={(b) => b.id} pageSize={8} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b, i) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="overflow-hidden">
                <div className="h-24 w-full" style={{ background: `linear-gradient(135deg, ${b.imageColor}, ${b.imageColor}99)` }} />
                <CardBody className="-mt-10">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-white text-base font-bold text-white shadow-soft" style={{ background: b.imageColor }}>
                    {b.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <h3 className="font-bold text-ink-950">{b.name}</h3>
                    <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-700/55">
                    <MapPin size={12} /> {b.location}, {b.city}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-700/55">
                    <Phone size={12} /> {b.leadName} &middot; {b.leadContact}
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-ink-900/[0.06] pt-3">
                    <Toggle checked={b.status === "Active"} onChange={() => toggleBranchStatus(b.id)} size="sm" />
                    <span className="text-xs font-medium text-ink-700/50">Toggle status</span>
                    <div className="ml-auto flex gap-1">
                      <IconBtn icon={<ListTree size={14} />} />
                      <IconBtn icon={<Edit2 size={14} />} />
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <CreateBranchModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={addBranch} />
    </div>
  );
}

function IconBtn({ icon }: { icon: React.ReactNode }) {
  return (
    <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 transition-colors hover:bg-brand-50 hover:text-brand-600">
      {icon}
    </button>
  );
}

function CreateBranchModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (b: Omit<Branch, "id" | "createdAt">) => void }) {
  const [name, setName] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadContact, setLeadContact] = useState("");
  const [dayOff, setDayOff] = useState("Sunday");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Karnataka");
  const [location, setLocation] = useState("");
  const [tiers, setTiers] = useState(tierDefaults.map((sessions) => ({ sessions, days: sessions * 3, discountPerSession: 25 })));

  function submit() {
    if (!name || !leadName || !leadContact || !location) return;
    onCreate({
      name, leadName, leadContact, dayOff, discountType: "Amount", tiers,
      country: "India", state, city: city || "Bengaluru", location,
      imageColor: "#4f46e5", status: "Active",
    });
    onClose();
    setName(""); setLeadName(""); setLeadContact(""); setLocation("");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Branch"
      subtitle="Register a new therapy centre and its package discount schedule."
      width="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} icon={<Building2 size={14} />}>Create Branch</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Branch Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jayanagar" />
        <Select label="Day Off" required options={dayList.map((d) => ({ label: d, value: d }))} value={dayOff} onChange={(e) => setDayOff(e.target.value)} />
        <Input label="Branch Lead Name" required value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Full name" />
        <Input label="Branch Lead Contact Number" required value={leadContact} onChange={(e) => setLeadContact(e.target.value)} placeholder="10-digit mobile" />
        <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Bengaluru" />
        <Input label="State" value={state} onChange={(e) => setState(e.target.value)} />
        <Textarea label="Location" required className="sm:col-span-2" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Full address" />
        <FileDrop label="Upload Branch Photo (jpeg)" />
      </div>

      <div className="mt-6">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-700/50">Session Package Discount Tiers</div>
        <div className="overflow-x-auto rounded-xl ring-1 ring-ink-900/[0.06]">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold uppercase text-ink-700/45">
                <th className="px-4 py-2.5 text-left">Sessions</th>
                <th className="px-4 py-2.5 text-left">No. of Days</th>
                <th className="px-4 py-2.5 text-left">Discount / Session (₹)</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t, i) => (
                <tr key={t.sessions} className="border-t border-ink-900/[0.05]">
                  <td className="px-4 py-2 font-semibold text-ink-900">{t.sessions}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={t.days}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setTiers((ts) => ts.map((x, idx) => (idx === i ? { ...x, days: v } : x)));
                      }}
                      className="h-8 w-24 rounded-lg bg-slate-50 px-2 text-sm ring-1 ring-inset ring-ink-900/10 outline-none focus:ring-brand-400"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={t.discountPerSession}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setTiers((ts) => ts.map((x, idx) => (idx === i ? { ...x, discountPerSession: v } : x)));
                      }}
                      className="h-8 w-24 rounded-lg bg-slate-50 px-2 text-sm ring-1 ring-inset ring-ink-900/10 outline-none focus:ring-brand-400"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
