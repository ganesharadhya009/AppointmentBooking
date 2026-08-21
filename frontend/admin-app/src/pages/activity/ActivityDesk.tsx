import { useState } from "react";
import { Check, X, CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Badge, statusTone } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea, FileDrop } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/store/appStore";
import type { LeaveRequest, RefundRequest, SupportTicket } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parentTickets, therapistTickets, therapyNamesList } from "@/lib/mockData";

export default function ActivityDesk() {
  const [tab, setTab] = useState("refunds");
  const { refundRequests, leaveRequests, branches } = useAppStore();

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Module 03"
        title="Activity Desk"
        description="The daily task queue — refund approvals, leave requests, support tickets, and manual bookings."
      />

      <div className="mb-5">
        <Tabs
          items={[
            { key: "refunds", label: "Refund Approvals", count: refundRequests.length },
            { key: "leave", label: "Leave Requests", count: leaveRequests.length },
            { key: "parentTickets", label: "Parent Tickets", count: parentTickets.length },
            { key: "therapistTickets", label: "Therapist Tickets", count: therapistTickets.length },
            { key: "book", label: "Book Appointment" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "refunds" && <RefundsTab />}
      {tab === "leave" && <LeaveTab />}
      {tab === "parentTickets" && <TicketsTab tickets={parentTickets} />}
      {tab === "therapistTickets" && <TicketsTab tickets={therapistTickets} />}
      {tab === "book" && <BookAppointmentTab branches={branches} />}
    </div>
  );
}

function RefundsTab() {
  const { refundRequests, updateRefundStatus } = useAppStore();
  const columns: Column<RefundRequest>[] = [
    { key: "parent", header: "Parent / Child", render: (r) => (
      <div><div className="font-semibold text-ink-900">{r.parentName}</div><div className="text-xs text-ink-700/45">{r.childName}</div></div>
    ) },
    { key: "doctor", header: "Doctor", render: (r) => r.doctorName },
    { key: "branch", header: "Branch", render: (r) => r.branchName },
    { key: "amount", header: "Amount", align: "right", render: (r) => <span className="font-semibold">{formatCurrency(r.amount)}</span> },
    { key: "date", header: "Cancelled On", render: (r) => formatDate(r.cancelledAt) },
    { key: "status", header: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: "action", header: "Action", align: "right", render: (r) => (
      r.status === "Under Process" ? (
        <div className="flex justify-end gap-1.5">
          <button onClick={() => updateRefundStatus(r.id, "Approved")} className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Check size={14} /></button>
          <button onClick={() => updateRefundStatus(r.id, "Rejected")} className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"><X size={14} /></button>
        </div>
      ) : <span className="text-xs text-ink-700/35">Resolved</span>
    ) },
  ];
  return (
    <>
      <FilterBar>
        <Input label="From Date" type="date" />
        <Input label="To Date" type="date" />
        <Select label="Branch" placeholder="All branches" options={[]} />
      </FilterBar>
      <Card><DataTable columns={columns} data={refundRequests} searchKeys={["parentName", "childName"]} rowKey={(r) => r.id} /></Card>
    </>
  );
}

function LeaveTab() {
  const { leaveRequests, updateLeaveStatus } = useAppStore();
  const columns: Column<LeaveRequest>[] = [
    { key: "therapist", header: "Therapist", render: (l) => <span className="font-semibold text-ink-900">{l.therapistName}</span> },
    { key: "branch", header: "Branch", render: (l) => l.branchName },
    { key: "range", header: "Leave Dates", render: (l) => `${formatDate(l.fromDate)} — ${formatDate(l.toDate)}` },
    { key: "reason", header: "Reason", render: (l) => l.reason },
    { key: "status", header: "Status", render: (l) => <Badge tone={statusTone(l.status)}>{l.status}</Badge> },
    { key: "action", header: "Action", align: "right", render: (l) => (
      l.status === "Pending" ? (
        <div className="flex justify-end gap-1.5">
          <button onClick={() => updateLeaveStatus(l.id, "Approved")} className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Check size={14} /></button>
          <button onClick={() => updateLeaveStatus(l.id, "Rejected")} className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"><X size={14} /></button>
        </div>
      ) : <span className="text-xs text-ink-700/35">Resolved</span>
    ) },
  ];
  return <Card><DataTable columns={columns} data={leaveRequests} searchKeys={["therapistName", "branchName"]} rowKey={(l) => l.id} /></Card>;
}

function TicketsTab({ tickets }: { tickets: SupportTicket[] }) {
  const [waitingFilter, setWaitingFilter] = useState("");
  const filteredTickets = tickets.filter((t) => !waitingFilter || t.waitingFor === waitingFilter);
  const columns: Column<SupportTicket>[] = [
    { key: "ticketNo", header: "Ticket #", render: (t) => <span className="font-mono text-xs font-semibold text-brand-700">{t.ticketNo}</span> },
    { key: "title", header: "Title", render: (t) => <span className="font-semibold text-ink-900">{t.title}</span> },
    { key: "category", header: "Category", render: (t) => <Badge tone="info">{t.category}</Badge> },
    { key: "raisedBy", header: "Raised By", render: (t) => t.raisedBy },
    { key: "waiting", header: "Waiting For", render: (t) => <Badge tone={t.waitingFor === "Admin reply" ? "warning" : "neutral"}>{t.waitingFor}</Badge> },
    { key: "status", header: "Status", render: (t) => <Badge tone={statusTone(t.status)}>{t.status}</Badge> },
  ];
  return (
    <>
      <FilterBar>
        <Select label="Waiting For" placeholder="All" options={[{ label: "Admin reply", value: "Admin reply" }, { label: "User reply", value: "User reply" }]} value={waitingFilter} onChange={(e) => setWaitingFilter(e.target.value)} />
        <Input label="Ticket Number" placeholder="Search ticket #" />
      </FilterBar>
      <Card><DataTable columns={columns} data={filteredTickets} searchKeys={["title", "ticketNo", "raisedBy"]} rowKey={(t) => t.id} /></Card>
    </>
  );
}

function BookAppointmentTab({ branches }: { branches: { id: number; name: string }[] }) {
  const [paymentType, setPaymentType] = useState<"Cash on Pay" | "Branch QR">("Cash on Pay");
  const [submitted, setSubmitted] = useState(false);

  return (
    <Card>
      <div className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><CalendarPlus size={15} /></div>
          <h3 className="text-sm font-bold text-ink-900">Book an appointment on a client's behalf</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Search Child by Name" required placeholder="Type to search..." />
          <Select label="Select Branch" required placeholder="Choose branch" options={branches.map((b) => ({ label: b.name, value: b.name }))} />
          <Select label="Select Therapy" required placeholder="Choose therapy" options={therapyNamesList.map((t) => ({ label: t, value: t }))} />
          <Select label="Select Therapist" required placeholder="Choose therapist" options={[]} />
          <Input label="Appointment Date" type="date" required />
          <Select label="Select Time Slot" required placeholder="Choose slot" options={["09:00 AM", "10:30 AM", "12:00 PM", "02:00 PM", "04:00 PM"].map((s) => ({ label: s, value: s }))} />
          <Input label="Appointment Cost" type="number" required placeholder="₹" />
          <FileDrop label="Payment Proof Image" />
          <Textarea label="Description" className="sm:col-span-2 lg:col-span-3" placeholder="Optional notes" />
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-semibold text-ink-700">Payment Type <span className="text-rose-500">*</span></label>
          <div className="flex gap-2">
            {(["Cash on Pay", "Branch QR"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPaymentType(p)}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${paymentType === p ? "bg-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(79,70,229,0.55)]" : "bg-slate-100 text-ink-700/60 hover:text-ink-900"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {submitted && (
          <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            Appointment booked successfully.
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={() => setSubmitted(true)}>Book Appointment</Button>
        </div>
      </div>
    </Card>
  );
}
