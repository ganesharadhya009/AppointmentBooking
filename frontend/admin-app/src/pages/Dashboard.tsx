import { useMemo } from "react";
import { Building2, Stethoscope, Users, UsersRound, CalendarCheck2, CreditCard, Ban, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile, MiniStat } from "@/components/ui/StatTile";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { DonutChart, DonutLegend } from "@/components/ui/DonutChart";
import { useAppStore } from "@/store/appStore";
import { appointments, paymentTxns, refundRequests, therapyNamesList } from "@/lib/mockData";
import { formatDate } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, statusTone } from "@/components/ui/Badge";

export default function Dashboard() {
  const { branches, therapists, adminUsers } = useAppStore();

  const activeBranches = branches.filter((b) => b.status === "Active").length;
  const activeTherapists = therapists.filter((t) => t.status === "Active").length;
  const activeAdmins = adminUsers.filter((u) => u.status === "Active").length;

  const todayAppts = useMemo(() => {
    const planned = appointments.filter((a) => a.status === "Planned").length;
    const completed = appointments.filter((a) => a.status === "Completed").length;
    const cancelled = appointments.filter((a) => a.status === "Cancelled").length;
    return { planned, completed, cancelled, total: planned + completed + cancelled };
  }, []);

  const txnSummary = useMemo(() => {
    const success = paymentTxns.filter((t) => t.txnStatus === "Success").length;
    const inProcess = paymentTxns.filter((t) => t.txnStatus === "In Process").length;
    const aborted = paymentTxns.filter((t) => t.txnStatus === "Aborted").length;
    const failed = paymentTxns.filter((t) => t.txnStatus === "Failed").length;
    return { success, inProcess, aborted, failed, total: success + inProcess + aborted + failed };
  }, []);

  const cancellations = useMemo(() => {
    const underProcess = refundRequests.filter((r) => r.status === "Under Process").length;
    const approved = refundRequests.filter((r) => r.status === "Approved").length;
    const rejected = refundRequests.filter((r) => r.status === "Rejected").length;
    return { underProcess, approved, rejected, total: underProcess + approved + rejected };
  }, []);

  const recentAppointments = appointments.slice(0, 6);

  return (
    <div>
      <PageHeader
        eyebrow="Landing · Module 02"
        title="Good to see you, Bimba Super Admin"
        description="Here's the network's operational pulse for today across branches, bookings and billing."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Branches"
          value={branches.length}
          icon={<Building2 size={18} />}
          tint="#4f46e5"
          sub={`${activeBranches} active · ${branches.length - activeBranches} inactive`}
          trend={{ value: "12%", up: true }}
        />
        <StatTile
          label="Therapy Sessions Catalog"
          value={therapyNamesList.length}
          icon={<Stethoscope size={18} />}
          tint="#0d9488"
          sub="Across all branches"
        />
        <StatTile
          label="Doctors / Therapists"
          value={therapists.length}
          icon={<Users size={18} />}
          tint="#f59e0b"
          sub={`${activeTherapists} active · ${therapists.length - activeTherapists} inactive`}
          trend={{ value: "4%", up: true }}
        />
        <StatTile
          label="Back-office Users"
          value={adminUsers.length}
          icon={<UsersRound size={18} />}
          tint="#f43f5e"
          sub={`${activeAdmins} active`}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <CalendarCheck2 size={15} />
              </div>
              <div>
                <div className="text-sm font-bold text-ink-900">Today's Appointments</div>
                <div className="text-[11px] text-ink-700/45">{formatDate(new Date())}</div>
              </div>
            </div>
            <span className="text-xl font-extrabold text-ink-950">{todayAppts.total}</span>
          </CardHeader>
          <CardBody className="flex flex-col items-center gap-5 sm:flex-row">
            <DonutChart
              centerValue={todayAppts.total}
              centerLabel="Total"
              data={[
                { name: "Planned", value: todayAppts.planned, color: "#f59e0b" },
                { name: "Completed", value: todayAppts.completed, color: "#10b981" },
                { name: "Cancelled", value: todayAppts.cancelled, color: "#f43f5e" },
              ]}
            />
            <div className="w-full flex-1">
              <DonutLegend
                data={[
                  { name: "Planned", value: todayAppts.planned, color: "#f59e0b" },
                  { name: "Completed", value: todayAppts.completed, color: "#10b981" },
                  { name: "Cancelled", value: todayAppts.cancelled, color: "#f43f5e" },
                ]}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <CreditCard size={15} />
              </div>
              <div>
                <div className="text-sm font-bold text-ink-900">Today's Transactions</div>
                <div className="text-[11px] text-ink-700/45">{formatDate(new Date())}</div>
              </div>
            </div>
            <span className="text-xl font-extrabold text-ink-950">{txnSummary.total}</span>
          </CardHeader>
          <CardBody className="flex flex-col items-center gap-5 sm:flex-row">
            <DonutChart
              centerValue={txnSummary.total}
              centerLabel="Total"
              data={[
                { name: "Success", value: txnSummary.success, color: "#10b981" },
                { name: "In Process", value: txnSummary.inProcess, color: "#0ea5e9" },
                { name: "Aborted", value: txnSummary.aborted, color: "#f59e0b" },
                { name: "Failed", value: txnSummary.failed, color: "#f43f5e" },
              ]}
            />
            <div className="w-full flex-1">
              <DonutLegend
                data={[
                  { name: "Success", value: txnSummary.success, color: "#10b981" },
                  { name: "In Process", value: txnSummary.inProcess, color: "#0ea5e9" },
                  { name: "Aborted", value: txnSummary.aborted, color: "#f59e0b" },
                  { name: "Failed", value: txnSummary.failed, color: "#f43f5e" },
                ]}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <Ban size={15} />
              </div>
              <div>
                <div className="text-sm font-bold text-ink-900">Cancellations</div>
                <div className="text-[11px] text-ink-700/45">Rolling count</div>
              </div>
            </div>
            <span className="text-xl font-extrabold text-ink-950">{cancellations.total}</span>
          </CardHeader>
          <CardBody className="flex flex-col items-center gap-5 sm:flex-row">
            <DonutChart
              centerValue={cancellations.total}
              centerLabel="Total"
              data={[
                { name: "Under Process", value: cancellations.underProcess, color: "#f59e0b" },
                { name: "Approved", value: cancellations.approved, color: "#10b981" },
                { name: "Rejected", value: cancellations.rejected, color: "#f43f5e" },
              ]}
            />
            <div className="w-full flex-1">
              <DonutLegend
                data={[
                  { name: "Under Process", value: cancellations.underProcess, color: "#f59e0b" },
                  { name: "Approved", value: cancellations.approved, color: "#10b981" },
                  { name: "Rejected", value: cancellations.rejected, color: "#f43f5e" },
                ]}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="text-sm font-bold text-ink-900">Recent Appointment Activity</div>
            <Badge tone="brand" dot={false}>
              <TrendingUp size={11} className="mr-0.5" /> Live feed
            </Badge>
          </CardHeader>
          <CardBody className="!p-0">
            <div className="divide-y divide-ink-900/[0.05]">
              {recentAppointments.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={a.childName} color="#6366f1" size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink-900">{a.childName}</div>
                    <div className="truncate text-xs text-ink-700/50">
                      {a.therapyName} &middot; {a.branchName} &middot; {formatDate(a.date)}
                    </div>
                  </div>
                  <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-bold text-ink-900">Branch Footprint</div>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {branches.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                  style={{ background: b.imageColor }}
                >
                  {b.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink-900">{b.name}</div>
                  <div className="truncate text-[11px] text-ink-700/45">{b.city}</div>
                </div>
                <Badge tone={statusTone(b.status)}>{b.status}</Badge>
              </div>
            ))}
            <div className="mt-1 flex gap-3">
              <MiniStat label="Active" value={activeBranches} tone="#10b981" />
              <MiniStat label="Inactive" value={branches.length - activeBranches} tone="#f43f5e" />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
