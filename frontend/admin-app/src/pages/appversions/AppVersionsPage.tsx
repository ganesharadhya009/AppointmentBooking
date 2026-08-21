import { useState } from "react";
import { Plus, Rocket, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { useAppStore } from "@/store/appStore";
import type { AppVersion } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function AppVersionsPage() {
  const { appVersions, toggleAppVersionStatus, addAppVersion } = useAppStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [appFilter, setAppFilter] = useState("");

  const filtered = appFilter ? appVersions.filter((v) => v.app === appFilter) : appVersions;

  const columns: Column<AppVersion>[] = [
    { key: "version", header: "Version", render: (v) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Smartphone size={15} /></div>
        <span className="font-mono font-bold text-ink-900">{v.version}</span>
      </div>
    ) },
    { key: "app", header: "App", render: (v) => <Badge tone="brand">{v.app}</Badge> },
    { key: "store", header: "Store", render: (v) => v.store },
    { key: "release", header: "Release Date", render: (v) => formatDate(v.releaseDate) },
    { key: "force", header: "Force Update", render: (v) => v.forceUpdate ? <Badge tone="warning">Required</Badge> : <Badge tone="neutral">Optional</Badge> },
    { key: "releasedBy", header: "Released By", render: (v) => <span className="text-ink-700/60">{v.releasedBy}</span> },
    { key: "status", header: "Status", render: (v) => (
      <div className="flex items-center gap-2">
        <Toggle checked={v.status === "Active"} onChange={() => toggleAppVersionStatus(v.id)} size="sm" />
        <Badge tone={statusTone(v.status)}>{v.status}</Badge>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Platform · Module 15"
        title="App Version Management"
        description="Release management for the companion Android apps — enforce forced updates from the backend."
        actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Create Version</Button>}
      />

      <FilterBar>
        <Select label="App" placeholder="All apps" options={[{ label: "Parent App", value: "Parent App" }, { label: "Doctor & Admin App", value: "Doctor & Admin App" }]} value={appFilter} onChange={(e) => setAppFilter(e.target.value)} />
      </FilterBar>

      <Card><DataTable columns={columns} data={filtered} searchKeys={["version", "app"]} rowKey={(v) => v.id} /></Card>

      <Modal
        open={createOpen} onClose={() => setCreateOpen(false)} title="Create App Version" subtitle="Publish a new release record."
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="primary" icon={<Rocket size={14} />} onClick={() => {
          addAppVersion({ version: "1.0.0", app: "Parent App", store: "Android", status: "Active", forceUpdate: false, releaseDate: new Date().toISOString(), description: "New release", releasedBy: "Bimba Super Admin" });
          setCreateOpen(false);
        }}>Publish</Button></>}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Version Number" required placeholder="e.g. 2.5.0" />
          <Select label="Target App" required options={[{ label: "Parent App", value: "Parent App" }, { label: "Doctor & Admin App", value: "Doctor & Admin App" }]} />
          <Select label="Store Type" options={[{ label: "Android", value: "Android" }]} defaultValue="Android" />
          <Input label="Release Date" type="date" required />
          <Select label="Require to Update" options={[{ label: "No", value: "no" }, { label: "Yes", value: "yes" }]} />
          <Select label="Release Status" options={[{ label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }]} />
          <Textarea label="Description" className="sm:col-span-2" placeholder="Bug fixes and performance improvements." />
        </div>
      </Modal>
    </div>
  );
}
