import { useState } from "react";
import { Image as ImageIcon, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input, Select, FileDrop } from "@/components/ui/Field";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { useAppStore } from "@/store/appStore";
import type { Poster } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function BannersPage() {
  const [tab, setTab] = useState("banner");
  const { posters } = useAppStore();

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
      {tab === "posters" && <PosterList />}
    </div>
  );
}

function BannerForm() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader><div className="text-sm font-bold text-ink-900">App Banner</div></CardHeader>
        <CardBody className="grid grid-cols-1 gap-4">
          <Input label="Banner Name" required defaultValue="CDC Connect Welcome Banner" />
          <Input label="Watermark Title" required defaultValue="BimBa Connect" />
          <FileDrop label="Banner Image" hint="Recommended: 1200×400px, JPEG" />
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
        </CardBody>
      </Card>

      <div className="lg:col-span-2 flex justify-end">
        <Button variant="primary">Save Changes</Button>
      </div>
    </div>
  );
}

function PosterList() {
  const { posters, togglePosterStatus, addPoster } = useAppStore();
  const [createOpen, setCreateOpen] = useState(false);

  const columns: Column<Poster>[] = [
    { key: "title", header: "Poster", render: (p) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: p.imageColor }}><ImageIcon size={15} /></div>
        <span className="font-semibold text-ink-900">{p.title}</span>
      </div>
    ) },
    { key: "position", header: "Position", render: (p) => <Badge tone="info">{p.position}</Badge> },
    { key: "priority", header: "Priority", align: "center", render: (p) => p.priority },
    { key: "range", header: "Active Range", render: (p) => `${formatDate(p.fromDate)} — ${formatDate(p.toDate)}` },
    { key: "status", header: "Status", render: (p) => (
      <div className="flex items-center gap-2">
        <Toggle checked={p.status === "Active"} onChange={() => togglePosterStatus(p.id)} size="sm" />
        <Badge tone={statusTone(p.status)}>{p.status}</Badge>
      </div>
    ) },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Create Poster</Button>
      </div>
      <FilterBar>
        <Select label="Status" placeholder="All" options={[{ label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }]} />
        <Input label="Date" type="date" />
      </FilterBar>
      <Card><DataTable columns={columns} data={posters} searchKeys={["title"]} rowKey={(p) => p.id} /></Card>

      <Modal
        open={createOpen} onClose={() => setCreateOpen(false)} title="Create Banner / Poster"
        subtitle="Schedule a promotional poster shown in-app."
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => {
          addPoster({ title: "New Promotion", type: "Poster Image", position: "Top", priority: posters.length + 1, fromDate: new Date().toISOString(), toDate: new Date(Date.now() + 12096e5).toISOString(), status: "Active", imageColor: "#4f46e5" });
          setCreateOpen(false);
        }}>Create Poster</Button></>}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Title" required placeholder="e.g. New Year Offer" />
          <Select label="Poster Type" options={[{ label: "Poster Image", value: "Poster Image" }]} defaultValue="Poster Image" />
          <Select label="Position" required options={[{ label: "Top", value: "Top" }, { label: "Bottom", value: "Bottom" }, { label: "Popup (30s timeout)", value: "Popup" }]} />
          <Input label="Priority" type="number" defaultValue={1} />
          <Input label="Active From" type="date" required />
          <Input label="Active To" type="date" required />
          <FileDrop label="Poster Image" className="sm:col-span-2" />
        </div>
      </Modal>
    </>
  );
}
