import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, Edit2, MapPin, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar, ViewToggle } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Card, CardBody } from "@/components/ui/Card";
import { directoryApi, ApiError, type PagedResult } from "@/lib/apiClient";
import { motion } from "framer-motion";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const REQUIRED_TIER_SESSION_COUNTS = [10, 24, 48, 72, 96];

interface DiscountTier {
  sessionCount: number;
  discountPerSession: number;
}

interface Branch {
  id: string;
  name: string;
  address: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  weeklyDayOff: number;
  photoUrl: string | null;
  isActive: boolean;
  discountTiers: DiscountTier[];
}

type ModalState = { mode: "create" } | { mode: "edit"; branch: Branch } | null;

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "card">("list");
  const [modalState, setModalState] = useState<ModalState>(null);
  const [cityFilter, setCityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const res = await directoryApi.get<PagedResult<Branch>>("/branches", { pageSize: 100 });
      setBranches(res.items);
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

  const cities = useMemo(() => [...new Set(branches.map((b) => b.city).filter((c): c is string => !!c))], [branches]);

  const filtered = useMemo(
    () =>
      branches.filter(
        (b) =>
          (!cityFilter || b.city === cityFilter) &&
          (!statusFilter || (statusFilter === "Active" ? b.isActive : !b.isActive))
      ),
    [branches, cityFilter, statusFilter]
  );

  async function toggleActive(branch: Branch) {
    const prevBranches = branches;
    setBranches((bs) => bs.map((b) => (b.id === branch.id ? { ...b, isActive: !b.isActive } : b)));
    try {
      await directoryApi.put(`/branches/${branch.id}`, {
        name: branch.name,
        address: branch.address,
        country: branch.country,
        state: branch.state,
        city: branch.city,
        latitude: branch.latitude,
        longitude: branch.longitude,
        weeklyDayOff: branch.weeklyDayOff,
        photoUrl: branch.photoUrl,
        isActive: !branch.isActive,
        discountTiers: branch.discountTiers,
      });
    } catch {
      setBranches(prevBranches);
    }
  }

  const columns: Column<Branch>[] = [
    {
      key: "name",
      header: "Branch",
      render: (b) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
            {b.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-ink-900">{b.name}</div>
            <div className="text-xs text-ink-700/45">{b.address ?? "No address on file"}</div>
          </div>
        </div>
      ),
    },
    { key: "city", header: "Location", render: (b) => <span>{[b.city, b.state].filter(Boolean).join(", ") || "—"}</span> },
    { key: "dayOff", header: "Weekly Day Off", render: (b) => DAY_LABELS[b.weeklyDayOff] },
    {
      key: "status",
      header: "Status",
      render: (b) => (
        <div className="flex items-center gap-2">
          <Toggle checked={b.isActive} onChange={() => toggleActive(b)} size="sm" />
          <Badge tone={statusTone(b.isActive ? "Active" : "Inactive")}>{b.isActive ? "Active" : "Inactive"}</Badge>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (b) => (
        <div className="flex justify-end gap-1">
          <IconBtn icon={<Edit2 size={14} />} onClick={() => setModalState({ mode: "edit", branch: b })} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Module 04"
        title="Branch Management"
        description="Physical therapy centres that scope therapy, therapist, appointment and holiday data across the network."
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModalState({ mode: "create" })}>
            Create Branch
          </Button>
        }
      />

      <FilterBar>
        <Select label="City" placeholder="All cities" options={cities.map((c) => ({ label: c, value: c }))} value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
        <Select
          label="Status"
          placeholder="All statuses"
          options={[
            { label: "Active", value: "Active" },
            { label: "Inactive", value: "Inactive" },
          ]}
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

      {view === "list" ? (
        <Card>
          <DataTable
            columns={columns}
            data={filtered}
            searchKeys={["name", "city"]}
            rowKey={(b) => b.id}
            pageSize={8}
            emptyLabel={loading ? "Loading…" : "No branches yet"}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b, i) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="overflow-hidden">
                <div className="h-24 w-full bg-gradient-to-br from-brand-600 to-brand-600/60" />
                <CardBody className="-mt-10">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-white bg-brand-600 text-base font-bold text-white shadow-soft">
                    {b.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <h3 className="font-bold text-ink-950">{b.name}</h3>
                    <Badge tone={statusTone(b.isActive ? "Active" : "Inactive")}>{b.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-700/55">
                    <MapPin size={12} /> {b.address ?? "No address"}{b.city ? `, ${b.city}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-ink-700/55">Weekly day off: {DAY_LABELS[b.weeklyDayOff]}</div>
                  <div className="mt-4 flex items-center gap-2 border-t border-ink-900/[0.06] pt-3">
                    <Toggle checked={b.isActive} onChange={() => toggleActive(b)} size="sm" />
                    <span className="text-xs font-medium text-ink-700/50">Toggle status</span>
                    <div className="ml-auto flex gap-1">
                      <IconBtn icon={<Edit2 size={14} />} onClick={() => setModalState({ mode: "edit", branch: b })} />
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <BranchModal state={modalState} onClose={() => setModalState(null)} onSaved={reload} />
    </div>
  );
}

function IconBtn({ icon, onClick }: { icon: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 transition-colors hover:bg-brand-50 hover:text-brand-600">
      {icon}
    </button>
  );
}

function BranchModal({ state, onClose, onSaved }: { state: ModalState; onClose: () => void; onSaved: () => void }) {
  const editing = state?.mode === "edit" ? state.branch : null;
  const [name, setName] = useState("");
  const [weeklyDayOff, setWeeklyDayOff] = useState(0);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state_, setState_] = useState("");
  const [country, setCountry] = useState("India");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [tiers, setTiers] = useState<DiscountTier[]>(REQUIRED_TIER_SESSION_COUNTS.map((sessionCount) => ({ sessionCount, discountPerSession: 0 })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state) return;
    setName(editing?.name ?? "");
    setWeeklyDayOff(editing?.weeklyDayOff ?? 0);
    setAddress(editing?.address ?? "");
    setCity(editing?.city ?? "");
    setState_(editing?.state ?? "");
    setCountry(editing?.country ?? "India");
    setLatitude(editing?.latitude != null ? String(editing.latitude) : "");
    setLongitude(editing?.longitude != null ? String(editing.longitude) : "");
    setPhotoUrl(editing?.photoUrl ?? "");
    setTiers(
      editing
        ? REQUIRED_TIER_SESSION_COUNTS.map((sessionCount) => ({
            sessionCount,
            discountPerSession: editing.discountTiers.find((t) => t.sessionCount === sessionCount)?.discountPerSession ?? 0,
          }))
        : REQUIRED_TIER_SESSION_COUNTS.map((sessionCount) => ({ sessionCount, discountPerSession: 0 }))
    );
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function submit() {
    if (!name) {
      setError("Branch name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        name,
        address: address || null,
        country: country || null,
        state: state_ || null,
        city: city || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        weeklyDayOff,
        photoUrl: photoUrl || null,
        discountTiers: tiers,
      };
      if (editing) {
        await directoryApi.put(`/branches/${editing.id}`, { ...body, isActive: editing.isActive });
      } else {
        await directoryApi.post("/branches", body);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this branch.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={editing ? "Edit Branch" : "Create Branch"}
      subtitle={editing ? "Update this therapy centre's details and discount schedule." : "Register a new therapy centre and its package discount schedule."}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} icon={<Building2 size={14} />} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Create Branch"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Branch Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jayanagar" />
        <Select
          label="Weekly Day Off"
          required
          options={DAY_LABELS.map((label, i) => ({ label, value: String(i) }))}
          value={String(weeklyDayOff)}
          onChange={(e) => setWeeklyDayOff(Number(e.target.value))}
        />
        <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Bengaluru" />
        <Input label="State" value={state_} onChange={(e) => setState_(e.target.value)} />
        <Input label="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
        <Input label="Photo URL" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
        <Input label="Latitude" type="number" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
        <Input label="Longitude" type="number" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
        <Textarea label="Address" className="sm:col-span-2" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
      </div>

      <div className="mt-6">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-700/50">Session Package Discount Tiers</div>
        <div className="overflow-x-auto rounded-xl ring-1 ring-ink-900/[0.06]">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold uppercase text-ink-700/45">
                <th className="px-4 py-2.5 text-left">Sessions</th>
                <th className="px-4 py-2.5 text-left">Discount / Session (₹)</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t, i) => (
                <tr key={t.sessionCount} className="border-t border-ink-900/[0.05]">
                  <td className="px-4 py-2 font-semibold text-ink-900">{t.sessionCount}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={t.discountPerSession}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setTiers((ts) => ts.map((x, idx) => (idx === i ? { ...x, discountPerSession: v } : x)));
                      }}
                      className="h-8 w-28 rounded-lg bg-slate-50 px-2 text-sm ring-1 ring-inset ring-ink-900/10 outline-none focus:ring-brand-400"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
