import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Badge, statusTone } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Card, CardBody } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { MiniStat } from "@/components/ui/StatTile";
import { appointments, otpLogs, paymentTxns, swapLogs, walletTxns } from "@/lib/mockData";
import { useAppStore } from "@/store/appStore";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { Appointment, OtpLog, PaymentTxn, SwapLog, WalletTxn } from "@/lib/types";

export default function OperationalReportsPage() {
  const [tab, setTab] = useState("branch");
  const { branches, therapists } = useAppStore();

  return (
    <div>
      <PageHeader
        eyebrow="Reporting · Module 10"
        title="Operational Reports"
        description="Six exportable ledgers covering the operational and financial trail of the platform."
      />

      <div className="mb-5">
        <Tabs
          items={[
            { key: "branch", label: "Branch Appointments" },
            { key: "wallet", label: "Wallet Transactions" },
            { key: "otp", label: "OTP Log" },
            { key: "txn", label: "Transactions" },
            { key: "swap", label: "Swap / Reschedule" },
            { key: "progress", label: "Therapist Progress" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "branch" && <BranchApptTab branches={branches} />}
      {tab === "wallet" && <WalletTab />}
      {tab === "otp" && <OtpTab />}
      {tab === "txn" && <TxnTab />}
      {tab === "swap" && <SwapTab />}
      {tab === "progress" && <ProgressTab therapists={therapists} branches={branches} />}
    </div>
  );
}

function BranchApptTab({ branches }: { branches: { name: string }[] }) {
  const columns: Column<Appointment>[] = [
    { key: "child", header: "Child", render: (a) => a.childName },
    { key: "branch", header: "Branch", render: (a) => a.branchName },
    { key: "therapy", header: "Therapy", render: (a) => a.therapyName },
    { key: "date", header: "Date", render: (a) => formatDate(a.date) },
    { key: "amount", header: "Amount", align: "right", render: (a) => formatCurrency(a.amount) },
    { key: "status", header: "Status", render: (a) => <Badge tone={statusTone(a.status)}>{a.status}</Badge> },
  ];
  return (
    <>
      <FilterBar onExport={() => alert("Exporting CSV...")}>
        <Input label="From Date" type="date" />
        <Input label="To Date" type="date" />
        <Select label="Branch" placeholder="All branches" options={branches.map((b) => ({ label: b.name, value: b.name }))} />
        <Select label="Status" placeholder="All statuses" options={["Planned", "Completed", "Cancelled"].map((s) => ({ label: s, value: s }))} />
      </FilterBar>
      <Card><DataTable columns={columns} data={appointments} searchKeys={["childName", "branchName"]} rowKey={(a) => a.id} /></Card>
    </>
  );
}

function WalletTab() {
  const credit = walletTxns.filter((w) => w.type === "Credit").reduce((s, w) => s + w.amount, 0);
  const debit = walletTxns.filter((w) => w.type === "Debit").reduce((s, w) => s + w.amount, 0);
  const columns: Column<WalletTxn>[] = [
    { key: "parent", header: "Parent", render: (w) => <span className="font-semibold text-ink-900">{w.parentName}</span> },
    { key: "type", header: "Type", render: (w) => <Badge tone={w.type === "Credit" ? "success" : "danger"}>{w.type}</Badge> },
    { key: "amount", header: "Amount", align: "right", render: (w) => formatCurrency(w.amount) },
    { key: "ref", header: "Reference", render: (w) => <span className="font-mono text-xs">{w.reference}</span> },
    { key: "date", header: "Date", render: (w) => formatDate(w.date) },
  ];
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:w-96">
        <MiniStat label="Total Credit" value={formatCurrency(credit)} tone="#10b981" />
        <MiniStat label="Total Debit" value={formatCurrency(debit)} tone="#f43f5e" />
      </div>
      <Card><DataTable columns={columns} data={walletTxns} searchKeys={["parentName", "reference"]} rowKey={(w) => w.id} /></Card>
    </>
  );
}

function OtpTab() {
  const columns: Column<OtpLog>[] = [
    { key: "number", header: "Number", render: (o) => o.number },
    { key: "otp", header: "OTP", render: (o) => <span className="font-mono font-bold tracking-wider">{o.otp}</span> },
    { key: "purpose", header: "Purpose", render: (o) => o.purpose },
    { key: "timestamp", header: "Timestamp", render: (o) => formatDateTime(o.timestamp) },
    { key: "status", header: "Status", render: (o) => <Badge tone={statusTone(o.status)}>{o.status}</Badge> },
  ];
  return <Card><DataTable columns={columns} data={otpLogs} searchKeys={["number", "purpose"]} rowKey={(o) => o.id} /></Card>;
}

function TxnTab() {
  const columns: Column<PaymentTxn>[] = [
    { key: "invoice", header: "Invoice #", render: (t) => <span className="font-mono text-xs font-semibold text-brand-700">{t.invoiceNo}</span> },
    { key: "parent", header: "Parent", render: (t) => t.parentName },
    { key: "amount", header: "Amount", align: "right", render: (t) => formatCurrency(t.amount) },
    { key: "discount", header: "Discount", align: "right", render: (t) => formatCurrency(t.discount) },
    { key: "paid", header: "Paid Amount", align: "right", render: (t) => <span className="font-semibold">{formatCurrency(t.paidAmount)}</span> },
    { key: "txnStatus", header: "Txn Status", render: (t) => <Badge tone={statusTone(t.txnStatus)}>{t.txnStatus}</Badge> },
    { key: "bookingStatus", header: "Booking Status", render: (t) => <Badge tone={statusTone(t.bookingStatus)}>{t.bookingStatus}</Badge> },
  ];
  return (
    <>
      <FilterBar onExport={() => alert("Exporting transactions...")}>
        <Input label="From Date" type="date" />
        <Input label="To Date" type="date" />
        <Select label="Txn Status" placeholder="All" options={["Success", "Failed", "In Process", "Aborted"].map((s) => ({ label: s, value: s }))} />
      </FilterBar>
      <Card><DataTable columns={columns} data={paymentTxns} searchKeys={["invoiceNo", "parentName"]} rowKey={(t) => t.id} /></Card>
    </>
  );
}

function SwapTab() {
  const columns: Column<SwapLog>[] = [
    { key: "branch", header: "Branch", render: (s) => s.branchName },
    { key: "child", header: "Child (Orig → New)", render: (s) => (
      <span className="flex items-center gap-1.5">{s.originalChild} <ArrowRightLeft size={12} className="text-ink-700/30" /> {s.swappedChild}</span>
    ) },
    { key: "therapist", header: "Therapist (Orig → New)", render: (s) => (
      <span className="flex items-center gap-1.5">{s.originalTherapist} <ArrowRightLeft size={12} className="text-ink-700/30" /> {s.swappedTherapist}</span>
    ) },
    { key: "date", header: "Date (Orig → New)", render: (s) => (
      <span>{formatDate(s.originalDate)} → {formatDate(s.swappedDate)}</span>
    ) },
  ];
  return <Card><DataTable columns={columns} data={swapLogs} searchKeys={["branchName", "originalChild"]} rowKey={(s) => s.id} /></Card>;
}

function ProgressTab({ therapists, branches }: { therapists: { name: string }[]; branches: { name: string }[] }) {
  const completed = appointments.filter((a) => a.status === "Completed");
  const cols: Column<Appointment>[] = [
    { key: "therapist", header: "Therapist", render: (a) => a.therapistName },
    { key: "child", header: "Child", render: (a) => a.childName },
    { key: "branch", header: "Branch", render: (a) => a.branchName },
    { key: "date", header: "Date", render: (a) => formatDate(a.date) },
    { key: "status", header: "Status", render: (a) => <Badge tone={statusTone(a.status)}>{a.status}</Badge> },
  ];
  return (
    <>
      <FilterBar>
        <Select label="Therapist" placeholder="All" options={therapists.map((t) => ({ label: t.name, value: t.name }))} />
        <Select label="Branch" placeholder="All" options={branches.map((b) => ({ label: b.name, value: b.name }))} />
      </FilterBar>
      <Card><CardBody className="!p-0"><DataTable columns={cols} data={completed} searchKeys={["therapistName", "childName"]} rowKey={(a) => a.id} /></CardBody></Card>
    </>
  );
}
