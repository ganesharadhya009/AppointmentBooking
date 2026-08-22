import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { directoryApi, ApiError } from "@/lib/apiClient";
import { useAuthStore, ROLE_LABELS } from "@/store/authStore";
import { formatDate } from "@/lib/utils";

interface StaffMemberDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: number;
  isActive: boolean;
  createdAt: string;
}

export function MyProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const staff = useAuthStore((s) => s.staff);
  const updateStaff = useAuthStore((s) => s.updateStaff);
  const [record, setRecord] = useState<StaffMemberDetail | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Deliberately keyed on `open` (and the id, which never changes for a given session) rather
    // than the whole `staff` object -- submit() below calls updateStaff() on success, which would
    // otherwise re-trigger this effect (new `staff` reference) and stomp the "Saved." confirmation
    // it just set, plus refire a redundant fetch.
    if (!open || !staff) return;
    setLoading(true);
    setError("");
    setSaved(false);
    directoryApi
      .get<StaffMemberDetail>(`/staff-members/${staff.id}`)
      .then((res) => {
        setRecord(res);
        setName(res.name);
        setEmail(res.email);
        setPhone(res.phone ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load your profile."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, staff?.id]);

  async function submit() {
    if (!record) return;
    if (!name || !email) {
      setError("Name and email are required.");
      return;
    }
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const updated = await directoryApi.put<StaffMemberDetail>(`/staff-members/${record.id}`, {
        name,
        email,
        phone: phone || null,
        role: record.role,
        isActive: record.isActive,
      });
      setRecord(updated);
      updateStaff({ id: updated.id, name: updated.name, email: updated.email, role: ROLE_LABELS[updated.role] });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="My Profile"
      subtitle="Your directory record."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={submit} disabled={saving || loading}>{saving ? "Saving…" : "Save Changes"}</Button>
        </>
      }
    >
      {loading ? (
        <div className="py-6 text-center text-sm text-ink-700/50">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink-700">Role</label>
            <div className="flex h-10 items-center">
              <Badge tone="brand">{record ? ROLE_LABELS[record.role] : ""}</Badge>
            </div>
          </div>
          {record && (
            <p className="text-[11px] text-ink-700/40 sm:col-span-2">
              Staff record created {formatDate(record.createdAt)}. Role can only be changed by an admin, from Admin Users.
            </p>
          )}
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}
      {saved && !error && <div className="mt-4 text-xs font-semibold text-emerald-600">Saved.</div>}
    </Modal>
  );
}
