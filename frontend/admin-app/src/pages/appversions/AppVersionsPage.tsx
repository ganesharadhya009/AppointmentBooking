import { useEffect, useState } from "react";
import { AlertCircle, Edit2, Plus, Rocket, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { directoryApi, ApiError, type PagedResult } from "@/lib/apiClient";
import { formatDate } from "@/lib/utils";

const TARGET_APP_LABELS = ["Admin Console", "Parent App", "Staff App"] as const;
const RELEASE_STATUS_LABELS = ["Draft", "Published", "Deprecated"] as const;
const RELEASE_STATUS_TONE: Tone[] = ["neutral", "success", "danger"];

interface AppVersion {
  id: string;
  targetApp: number;
  versionNumber: string;
  releaseStatus: number;
  requireUpdate: boolean;
  releaseDate: string;
  createdAt: string;
}

type ModalState = { mode: "create" } | { mode: "edit"; version: AppVersion } | null;

export default function AppVersionsPage() {
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [appFilter, setAppFilter] = useState("");
  const [modalState, setModalState] = useState<ModalState>(null);

  async function reload() {
    setLoading(true);
    try {
      const res = await directoryApi.get<PagedResult<AppVersion>>("/app-versions", { pageSize: 100 });
      setVersions(res.items);
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

  const filtered = appFilter ? versions.filter((v) => TARGET_APP_LABELS[v.targetApp] === appFilter) : versions;

  const columns: Column<AppVersion>[] = [
    {
      key: "version",
      header: "Version",
      render: (v) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Smartphone size={15} />
          </div>
          <span className="font-mono font-bold text-ink-900">{v.versionNumber}</span>
        </div>
      ),
    },
    { key: "app", header: "App", render: (v) => <Badge tone="brand">{TARGET_APP_LABELS[v.targetApp]}</Badge> },
    { key: "release", header: "Release Date", render: (v) => formatDate(v.releaseDate) },
    {
      key: "force",
      header: "Force Update",
      render: (v) => (v.requireUpdate ? <Badge tone="warning">Required</Badge> : <Badge tone="neutral">Optional</Badge>),
    },
    {
      key: "status",
      header: "Status",
      render: (v) => <Badge tone={RELEASE_STATUS_TONE[v.releaseStatus]}>{RELEASE_STATUS_LABELS[v.releaseStatus]}</Badge>,
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (v) => (
        <button
          onClick={() => setModalState({ mode: "edit", version: v })}
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
        eyebrow="Platform · Module 15"
        title="App Version Management"
        description="Release management for the companion apps — enforce forced updates from the backend."
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModalState({ mode: "create" })}>
            Create Version
          </Button>
        }
      />

      <FilterBar>
        <Select
          label="App"
          placeholder="All apps"
          options={TARGET_APP_LABELS.map((label) => ({ label, value: label }))}
          value={appFilter}
          onChange={(e) => setAppFilter(e.target.value)}
        />
      </FilterBar>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          searchKeys={["versionNumber"]}
          rowKey={(v) => v.id}
          emptyLabel={loading ? "Loading…" : "No app versions yet"}
        />
      </Card>

      <AppVersionModal state={modalState} onClose={() => setModalState(null)} onSaved={reload} />
    </div>
  );
}

function AppVersionModal({ state, onClose, onSaved }: { state: ModalState; onClose: () => void; onSaved: () => void }) {
  const editing = state?.mode === "edit" ? state.version : null;
  const [targetApp, setTargetApp] = useState<(typeof TARGET_APP_LABELS)[number]>(TARGET_APP_LABELS[1]);
  const [versionNumber, setVersionNumber] = useState("");
  const [releaseStatus, setReleaseStatus] = useState<(typeof RELEASE_STATUS_LABELS)[number]>(RELEASE_STATUS_LABELS[0]);
  const [requireUpdate, setRequireUpdate] = useState(false);
  const [releaseDate, setReleaseDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state) return;
    setTargetApp(editing ? TARGET_APP_LABELS[editing.targetApp] : TARGET_APP_LABELS[1]);
    setVersionNumber(editing?.versionNumber ?? "");
    setReleaseStatus(editing ? RELEASE_STATUS_LABELS[editing.releaseStatus] : RELEASE_STATUS_LABELS[0]);
    setRequireUpdate(editing?.requireUpdate ?? false);
    setReleaseDate(editing ? editing.releaseDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function submit() {
    if (!versionNumber || !releaseDate) {
      setError("Version number and release date are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        targetApp: TARGET_APP_LABELS.indexOf(targetApp),
        versionNumber,
        releaseStatus: RELEASE_STATUS_LABELS.indexOf(releaseStatus),
        requireUpdate,
        releaseDate,
      };
      if (editing) {
        await directoryApi.put(`/app-versions/${editing.id}`, body);
      } else {
        await directoryApi.post("/app-versions", body);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this app version.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={editing ? "Edit App Version" : "Create App Version"}
      subtitle={editing ? "Update this release record." : "Publish a new release record."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Rocket size={14} />} onClick={submit} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Publish"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Version Number"
          required
          placeholder="e.g. 2.5.0"
          value={versionNumber}
          onChange={(e) => setVersionNumber(e.target.value)}
        />
        <Select
          label="Target App"
          required
          options={TARGET_APP_LABELS.map((label) => ({ label, value: label }))}
          value={targetApp}
          onChange={(e) => setTargetApp(e.target.value as (typeof TARGET_APP_LABELS)[number])}
        />
        <Input label="Release Date" type="date" required value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
        <Select
          label="Require Update"
          options={[
            { label: "No", value: "no" },
            { label: "Yes", value: "yes" },
          ]}
          value={requireUpdate ? "yes" : "no"}
          onChange={(e) => setRequireUpdate(e.target.value === "yes")}
        />
        <Select
          label="Release Status"
          className="sm:col-span-2"
          options={RELEASE_STATUS_LABELS.map((label) => ({ label, value: label }))}
          value={releaseStatus}
          onChange={(e) => setReleaseStatus(e.target.value as (typeof RELEASE_STATUS_LABELS)[number])}
        />
      </div>
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </Modal>
  );
}
