import { useState } from "react";
import { Edit2, Lock, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, FileDrop } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { useAppStore } from "@/store/appStore";
import type { AdminRole, AdminUser } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const roleOptions: AdminRole[] = ["Super Admin", "Admin", "Auditor", "Therapist", "HR"];

export default function AdminUsersPage() {
  const { adminUsers, toggleAdminStatus, addAdminUser } = useAppStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");

  const filtered = roleFilter ? adminUsers.filter((u) => u.role === roleFilter) : adminUsers;

  const columns: Column<AdminUser>[] = [
    { key: "name", header: "User", render: (u) => (
      <div className="flex items-center gap-3">
        <Avatar name={u.name} color={u.avatarColor} size={34} />
        <div>
          <div className="font-semibold text-ink-900">{u.name}</div>
          <div className="text-xs text-ink-700/45">{u.email}</div>
        </div>
      </div>
    ) },
    { key: "contact", header: "Contact", render: (u) => u.contact },
    { key: "role", header: "Role", render: (u) => (
      <Badge tone={u.role === "Super Admin" ? "brand" : u.role === "Auditor" ? "info" : "neutral"}>{u.role}</Badge>
    ) },
    { key: "createdAt", header: "Created On", render: (u) => formatDate(u.createdAt) },
    { key: "status", header: "Status", render: (u) => (
      <div className="flex items-center gap-2">
        <Toggle checked={u.status === "Active"} onChange={() => toggleAdminStatus(u.id)} size="sm" />
        <Badge tone={statusTone(u.status)}>{u.status}</Badge>
      </div>
    ) },
    { key: "action", header: "Action", align: "right", render: () => (
      <div className="flex justify-end gap-1">
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><Edit2 size={14} /></button>
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"><Lock size={13} /></button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Platform · Module 16"
        title="Admin User Management"
        description="Back-office staff accounts — the same roles offered at the shared login screen."
        actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Create Admin</Button>}
      />

      <FilterBar>
        <Select label="Role" placeholder="All roles" options={roleOptions.map((r) => ({ label: r, value: r }))} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} />
      </FilterBar>

      <Card><DataTable columns={columns} data={filtered} searchKeys={["name", "email", "contact"]} rowKey={(u) => u.id} /></Card>

      <CreateAdminModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={addAdminUser} />
    </div>
  );
}

function CreateAdminModal({
  open, onClose, onCreate,
}: {
  open: boolean; onClose: () => void;
  onCreate: (u: Omit<AdminUser, "id" | "createdAt" | "avatarColor">) => void;
}) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("Admin");

  function submit() {
    if (!name || !contact || !email) return;
    onCreate({ name, dob: dob || new Date().toISOString(), contact, email, role, status: "Active" });
    onClose();
    setName(""); setContact(""); setEmail("");
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Create Admin" subtitle="Provision a new back-office account."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" icon={<ShieldCheck size={14} />} onClick={submit}>Create Admin</Button></>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Date of Birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        <Input label="Contact Number" required value={contact} onChange={(e) => setContact(e.target.value)} />
        <Input label="Email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" defaultValue="Bimba@1234" />
        <Select label="User Type" required options={roleOptions.map((r) => ({ label: r, value: r }))} value={role} onChange={(e) => setRole(e.target.value as AdminRole)} />
        <FileDrop label="Photo" className="sm:col-span-2" />
      </div>
    </Modal>
  );
}
