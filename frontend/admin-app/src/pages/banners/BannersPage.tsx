import { useEffect, useState } from "react";
import { AlertCircle, Edit2, Image as ImageIcon, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { directoryApi, ApiError, type PagedResult } from "@/lib/apiClient";
import { formatDate } from "@/lib/utils";

// PosterPosition matches DirectoryApi.Entities.PosterPosition exactly (Top=0, Bottom=1, Popup=2).
const POSITION_LABELS = ["Top", "Bottom", "Popup"];

interface Banner {
  id: string;
  imageUrl: string;
  watermarkTitle: string;
}

interface Poster {
  id: string;
  type: string;
  position: number;
  activeFrom: string;
  activeTo: string;
  priority: number;
  isActive: boolean;
}

export default function BannersPage() {
  const [tab, setTab] = useState("banner");
  const [posters, setPosters] = useState<Poster[]>([]);
  const [postersLoading, setPostersLoading] = useState(true);

  async function reloadPosters() {
    setPostersLoading(true);
    try {
      const res = await directoryApi.get<PagedResult<Poster>>("/posters", { pageSize: 100 });
      setPosters(res.items);
    } catch {
      // BannerForm and PosterList each surface their own load errors
    } finally {
      setPostersLoading(false);
    }
  }

  useEffect(() => {
    reloadPosters();
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Platform · Module 14"
        title="Banners & Posters"
        description="Marketing surface — app logo watermark, company invoicing profile, and scheduled promotional posters."
      />

      <div className="mb-5">
        <Tabs
          items={[
            { key: "banner", label: "Banner & Profile" },
            { key: "posters", label: "Poster List", count: posters.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "banner" && <BannerForm />}
      {tab === "posters" && <PosterList posters={posters} loading={postersLoading} onReload={reloadPosters} />}
    </div>
  );
}

function BannerForm() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [watermarkTitle, setWatermarkTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    directoryApi
      .get<PagedResult<Banner>>("/banners", { pageSize: 1 })
      .then((res) => {
        const existing = res.items[0] ?? null;
        setBanner(existing);
        setImageUrl(existing?.imageUrl ?? "");
        setWatermarkTitle(existing?.watermarkTitle ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't reach directory-api."))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!imageUrl || !watermarkTitle) {
      setError("Banner image URL and watermark title are both required.");
      return;
    }
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      if (banner) {
        const updated = await directoryApi.put<Banner>(`/banners/${banner.id}`, { imageUrl, watermarkTitle });
        setBanner(updated);
      } else {
        const created = await directoryApi.post<Banner>("/banners", { imageUrl, watermarkTitle });
        setBanner(created);
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the banner.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader><div className="text-sm font-bold text-ink-900">App Banner</div></CardHeader>
        <CardBody className="grid grid-cols-1 gap-4">
          <Input label="Watermark Title" required value={watermarkTitle} onChange={(e) => setWatermarkTitle(e.target.value)} placeholder="e.g. BimBa Connect" />
          <Input label="Banner Image URL" required value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" hint="Recommended: 1200×400px, JPEG" />
          {imageUrl && <img src={imageUrl} alt="Banner preview" className="h-24 w-full rounded-xl object-cover ring-1 ring-ink-900/10" />}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {saved && !error && <div className="text-xs font-semibold text-emerald-600">Saved.</div>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><div className="text-sm font-bold text-ink-900">Company / Invoicing Profile</div></CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Legal Name" required defaultValue="Srijana Healthcare Solutions Pvt. Ltd." className="sm:col-span-2" />
          <Input label="GSTIN" required defaultValue="29AACCS1234K1Z5" />
          <Input label="SAC Code" defaultValue="999312" />
          <Input label="Service Tax Category" defaultValue="Healthcare Services" />
          <Input label="Invoice ID Prefix" defaultValue="INV-" />
          <Input label="Platform Fee (%)" type="number" defaultValue={2} />
          <Input label="Support Contact" defaultValue="+91 80 4567 8900" />
          <Input label="Support Address" className="sm:col-span-2" defaultValue="Banashankari II Stage, Bengaluru 560070" />
          <p className="text-[11px] text-ink-700/40 sm:col-span-2">
            Not backed by any API yet — directory-api has no invoicing-profile entity, so this section can't be saved.
          </p>
        </CardBody>
      </Card>

      <div className="lg:col-span-2 flex justify-end">
        <Button variant="primary" onClick={save} disabled={saving || loading}>{saving ? "Saving…" : "Save Changes"}</Button>
      </div>
    </div>
  );
}

function PosterList({ posters, loading, onReload }: { posters: Poster[]; loading: boolean; onReload: () => void }) {
  const [modalState, setModalState] = useState<{ mode: "create" } | { mode: "edit"; poster: Poster } | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = statusFilter ? posters.filter((p) => (statusFilter === "Active" ? p.isActive : !p.isActive)) : posters;

  async function toggleActive(poster: Poster) {
    try {
      await directoryApi.put(`/posters/${poster.id}`, {
        type: poster.type,
        position: poster.position,
        activeFrom: poster.activeFrom,
        activeTo: poster.activeTo,
        priority: poster.priority,
        isActive: !poster.isActive,
      });
      onReload();
    } catch {
      // reload on next action will reflect true server state
    }
  }

  const columns: Column<Poster>[] = [
    {
      key: "title",
      header: "Poster",
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white"><ImageIcon size={15} /></div>
          <span className="font-semibold text-ink-900">{p.type}</span>
        </div>
      ),
    },
    { key: "position", header: "Position", render: (p) => <Badge tone="info">{POSITION_LABELS[p.position]}</Badge> },
    { key: "priority", header: "Priority", align: "center", render: (p) => p.priority },
    { key: "range", header: "Active Range", render: (p) => `${formatDate(p.activeFrom)} — ${formatDate(p.activeTo)}` },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <div className="flex items-center gap-2">
          <Toggle checked={p.isActive} onChange={() => toggleActive(p)} size="sm" />
          <Badge tone={statusTone(p.isActive ? "Active" : "Inactive")}>{p.isActive ? "Active" : "Inactive"}</Badge>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (p) => (
        <button
          onClick={() => setModalState({ mode: "edit", poster: p })}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"
        >
          <Edit2 size={14} />
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModalState({ mode: "create" })}>Create Poster</Button>
      </div>
      <FilterBar>
        <Select
          label="Status"
          placeholder="All"
          options={[{ label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
        <Input label="Date" type="date" />
      </FilterBar>
      <Card><DataTable columns={columns} data={filtered} searchKeys={["type"]} rowKey={(p) => p.id} emptyLabel={loading ? "Loading…" : "No posters yet"} /></Card>

      <PosterModal state={modalState} onClose={() => setModalState(null)} onSaved={onReload} />
    </>
  );
}

function PosterModal({
  state, onClose, onSaved,
}: {
  state: { mode: "create" } | { mode: "edit"; poster: Poster } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = state?.mode === "edit" ? state.poster : null;
  const [type, setType] = useState("");
  const [position, setPosition] = useState("0");
  const [priority, setPriority] = useState("1");
  const [activeFrom, setActiveFrom] = useState("");
  const [activeTo, setActiveTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state) return;
    setType(editing?.type ?? "");
    setPosition(editing ? String(editing.position) : "0");
    setPriority(editing ? String(editing.priority) : "1");
    setActiveFrom(editing?.activeFrom.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setActiveTo(editing?.activeTo.slice(0, 10) ?? new Date(Date.now() + 12096e5).toISOString().slice(0, 10));
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function submit() {
    if (!type || !activeFrom || !activeTo) {
      setError("Title, active from and active to are all required.");
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      type,
      position: Number(position),
      activeFrom,
      activeTo,
      priority: Number(priority) || 0,
      isActive: editing ? editing.isActive : true,
    };
    try {
      if (editing) {
        await directoryApi.put(`/posters/${editing.id}`, body);
      } else {
        await directoryApi.post("/posters", body);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this poster.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={editing ? "Edit Poster" : "Create Banner / Poster"}
      subtitle="Schedule a promotional poster shown in-app."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Poster"}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Title" required value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. New Year Offer" />
        <Select
          label="Position"
          required
          options={POSITION_LABELS.map((label, i) => ({ label: i === 2 ? "Popup (30s timeout)" : label, value: String(i) }))}
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />
        <Input label="Priority" type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
        <Input label="Active From" type="date" required value={activeFrom} onChange={(e) => setActiveFrom(e.target.value)} />
        <Input label="Active To" type="date" required value={activeTo} onChange={(e) => setActiveTo(e.target.value)} />
      </div>
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </Modal>
  );
}
