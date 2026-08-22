import { useState } from "react";
import { Info } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function handleClose() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Change Password"
      subtitle="Update the password for your account."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Close</Button>
          <Button variant="primary" disabled>Update Password</Button>
        </>
      }
    >
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Password changes aren&apos;t available yet — sign-in doesn&apos;t use a password today, and real
          authentication (planned via Auth0) hasn&apos;t been wired up. This form will work once that&apos;s in place.
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled />
        <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled />
        <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled />
      </div>
    </Modal>
  );
}
