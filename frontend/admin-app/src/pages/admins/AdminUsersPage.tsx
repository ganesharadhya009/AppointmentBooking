import { useEffect, useState } from "react";
import { AlertCircle, Edit2, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { directoryApi, ApiError, type PagedResult } from "@/lib/apiClient";
import { ROLE_LABELS, type StaffRole } from "@/store/authStore";
import { formatDate } from "@/lib/utils";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: number;
  isActive: boolean;
  createdAt: string;
}

type ModalState = { mode: "create" } | { mode: "edit"; staff: StaffMember } | null;

export default function AdminUsersPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [modalState, setModalState] = useState<ModalState>(null);

  async function reload() {
    setLoading(true);
    try {
      const res = await directoryApi.get<PagedResult<StaffMember>>("/staff-members", { pageSize: 100 });
      setStaff(res.items);
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

  const filtered = roleFilter ? staff.filter((s) => ROLE_LABELS[s.role] === roleFilter) : staff;

  async function toggleActive(member: StaffMember) {
    const prevStaff = staff;
    setStaff((s) => s.map((m) => (m.id === member.id ? { ...m, isActive: !m.isActive } : m)));
    try {
      await directoryApi.put(`/staff-members/${member.id}`, {
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: member.role,
        isActive: !member.isActive,
      });
    } catch {
      setStaff(prevStaff);
    }
  }

  const columns: Column<StaffMember>[] = [
    {
      key: "name",
      header: "User",
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} color="#4f46e5" size={34} />
          <div>
            <div className="font-semibold text-ink-900">{u.name}</div>
            <div className="text-xs text-ink-700/45">{u.email}</div>
          </div>
        </div>
      ),
    },
    { key: "phone", header: "Contact", render: (u) => u.phone ?? "—" },
    { key: "role", header: "Role", render: (u) => <Badge tone={u.role === 0 ? "brand" : "neutral"}>{ROLE_LABELS[u.role]}</Badge> },
    { key: "createdAt", header: "Created On", render: (u) => formatDate(u.createdAt) },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <div className="flex items-center gap-2">
          <Toggle checked={u.isActive} onChange={() => toggleActive(u)} size="sm" />
          <Badge tone={statusTone(u.isActive ? "Active" : "Inactive")}>{u.isActive ? "Active" : "Inactive"}</Badge>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (u) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={() => setModalState({ mode: "edit", staff: u })}
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
        eyebrow="Platform · Module 16"
        title="Admin User Management"
        description="Back-office staff accounts — the same directory the shared login screen checks against."
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModalState({ mode: "create" })}>
            Create Admin
          </Button>
        }
      />

      <FilterBar>
        <Select
          label="Role"
          placeholder="All roles"
          options={ROLE_LABELS.map((r) => ({ label: r, value: r }))}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
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
          searchKeys={["name", "email"]}
          rowKey={(u) => u.id}
          emptyLabel={loading ? "Loading…" : "No staff members yet"}
        />
      </Card>

      <StaffMemberModal state={modalState} onClose={() => setModalState(null)} onSaved={reload} />
    </div>
  );
}

function StaffMemberModal({ state, onClose, onSaved }: { state: ModalState; onClose: () => void; onSaved: () => void }) {
  const editing = state?.mode === "edit" ? state.staff : null;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole>("Admin");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state) return;
    setName(editing?.name ?? "");
    setEmail(editing?.email ?? "");
    setPhone(editing?.phone ?? "");
    setRole(editing ? ROLE_LABELS[editing.role] : "Admin");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function submit() {
    if (!name || !email) {
      setError("Name and email are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const roleIndex = ROLE_LABELS.indexOf(role);
      if (editing) {
        await directoryApi.put(`/staff-members/${editing.id}`, {
          name,
          email,
          phone: phone || null,
          role: roleIndex,
          isActive: editing.isActive,
        });
      } else {
        await directoryApi.post("/staff-members", { name, email, phone: phone || null, role: roleIndex });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this staff member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={editing ? "Edit Admin" : "Create Admin"}
      subtitle={editing ? "Update this staff member's directory record." : "Provision a new back-office account."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<ShieldCheck size={14} />} onClick={submit} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Create Admin"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Select
          label="Role"
          required
          options={ROLE_LABELS.map((r) => ({ label: r, value: r }))}
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
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
