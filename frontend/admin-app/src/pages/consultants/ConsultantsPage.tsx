import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Edit2, HeartPulse, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ViewToggle } from "@/components/ui/FilterBar";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardBody } from "@/components/ui/Card";
import { directoryApi, ApiError, type PagedResult } from "@/lib/apiClient";
import { formatCurrency } from "@/lib/utils";

// ConsultantStatus is a plain Active/Inactive enum on the backend (0/1) -- unlike Branches/Therapy,
// there's no separate "Deleted" state; DELETE just sets Status to Inactive.
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WINDOW_LABELS = ["Morning", "Noon", "Afternoon", "Evening"] as const;

interface ConsultantService {
  id: string;
  name: string;
  photoUrl: string | null;
  status: number;
}

interface ConsultantClinic {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  leadContactName: string | null;
  leadContactPhone: string | null;
  status: number;
}

interface SessionWindow {
  windowName: number;
  startTime: string;
  endTime: string;
  pricePerSession: number;
}

interface ConsultantDoctor {
  id: string;
  name: string;
  consultantServiceId: string;
  consultationFee: number;
  status: number;
  mobile: string | null;
  email: string | null;
  gender: string | null;
  licenseNumber: string | null;
  qualification: string | null;
  experienceYears: number | null;
  photoUrl: string | null;
  dayOff: number | null;
  clinicIds: string[];
  sessionWindows: SessionWindow[];
}

export default function ConsultantsPage() {
  const [services, setServices] = useState<ConsultantService[]>([]);
  const [clinics, setClinics] = useState<ConsultantClinic[]>([]);
  const [doctors, setDoctors] = useState<ConsultantDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("services");
  const [view, setView] = useState<"list" | "card">("card");

  async function reload() {
    setLoading(true);
    try {
      const [serviceRes, clinicRes, doctorRes] = await Promise.all([
        directoryApi.get<PagedResult<ConsultantService>>("/consultant-services", { pageSize: 100 }),
        directoryApi.get<PagedResult<ConsultantClinic>>("/consultant-clinics", { pageSize: 100 }),
        directoryApi.get<PagedResult<ConsultantDoctor>>("/consultant-doctors", { pageSize: 100 }),
      ]);
      setServices(serviceRes.items);
      setClinics(clinicRes.items);
      setDoctors(doctorRes.items);
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

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Module 07"
        title="Consultant Management"
        description="A parallel track for external consulting doctors operating out of partner clinics — services, clinics, and doctors."
        actions={<ViewToggle view={view} onChange={setView} />}
      />

      <div className="mb-5">
        <Tabs
          items={[
            { key: "services", label: "Services", count: services.length },
            { key: "clinics", label: "Hospitals / Clinics", count: clinics.length },
            { key: "doctors", label: "Doctors", count: doctors.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {tab === "services" && <ServicesTab services={services} loading={loading} view={view} onReload={reload} />}
      {tab === "clinics" && <ClinicsTab clinics={clinics} loading={loading} view={view} onReload={reload} />}
      {tab === "doctors" && (
        <DoctorsTab doctors={doctors} services={services} clinics={clinics} loading={loading} view={view} onReload={reload} />
      )}
    </div>
  );
}

// ================= Services =================

function ServicesTab({
  services, loading, view, onReload,
}: { services: ConsultantService[]; loading: boolean; view: "list" | "card"; onReload: () => void }) {
  const [modalState, setModalState] = useState<{ mode: "create" } | { mode: "edit"; service: ConsultantService } | null>(null);

  async function toggleActive(service: ConsultantService) {
    try {
      await directoryApi.put(`/consultant-services/${service.id}`, {
        name: service.name,
        photoUrl: service.photoUrl,
        status: service.status === 0 ? 1 : 0,
      });
      onReload();
    } catch {
      // reload will restore server state on next tab visit; nothing local to roll back
    }
  }

  const columns: Column<ConsultantService>[] = [
    {
      key: "name",
      header: "Service",
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar name={s.name} color="#4f46e5" size={34} photoUrl={s.photoUrl ?? undefined} />
          <span className="font-semibold text-ink-900">{s.name}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (s) => (
        <div className="flex items-center gap-2">
          <Toggle checked={s.status === 0} onChange={() => toggleActive(s)} size="sm" />
          <Badge tone={statusTone(s.status === 0 ? "Active" : "Inactive")}>{s.status === 0 ? "Active" : "Inactive"}</Badge>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (s) => (
        <button
          onClick={() => setModalState({ mode: "edit", service: s })}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"
        >
          <Edit2 size={14} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModalState({ mode: "create" })}>
          Add Service
        </Button>
      </div>

      {view === "list" ? (
        <Card>
          <DataTable columns={columns} data={services} searchKeys={["name"]} rowKey={(s) => s.id} emptyLabel={loading ? "Loading…" : "No consultant services yet"} />
        </Card>
      ) : services.length === 0 && !loading ? (
        <Card><CardBody className="text-center text-sm text-ink-700/50">No consultant services yet.</CardBody></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {services.map((s) => (
            <Card key={s.id}>
              <CardBody>
                {s.photoUrl ? (
                  <img src={s.photoUrl} alt={s.name} className="h-11 w-11 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
                    <HeartPulse size={18} />
                  </div>
                )}
                <h3 className="mt-3 font-bold text-ink-950">{s.name}</h3>
                <div className="mt-3 flex items-center justify-between border-t border-ink-900/[0.06] pt-3">
                  <Badge tone={statusTone(s.status === 0 ? "Active" : "Inactive")}>{s.status === 0 ? "Active" : "Inactive"}</Badge>
                  <div className="flex items-center gap-1">
                    <Toggle checked={s.status === 0} onChange={() => toggleActive(s)} size="sm" />
                    <button
                      onClick={() => setModalState({ mode: "edit", service: s })}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ServiceModal state={modalState} onClose={() => setModalState(null)} onSaved={onReload} />
    </div>
  );
}

function ServiceModal({
  state, onClose, onSaved,
}: {
  state: { mode: "create" } | { mode: "edit"; service: ConsultantService } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = state?.mode === "edit" ? state.service : null;
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state) return;
    setName(editing?.name ?? "");
    setPhotoUrl(editing?.photoUrl ?? "");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function submit() {
    if (!name) {
      setError("Service name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await directoryApi.put(`/consultant-services/${editing.id}`, { name, photoUrl: photoUrl || null, status: editing.status });
      } else {
        await directoryApi.post("/consultant-services", { name, photoUrl: photoUrl || null });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this service.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={editing ? "Edit Consultant Service" : "Add Consultant Service"}
      subtitle="A category of external consultation, e.g. Pediatric Neurology."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Service"}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Service Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pediatric Neurology" />
        <Input label="Photo URL" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
      </div>
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </Modal>
  );
}

// ================= Clinics =================

function ClinicsTab({
  clinics, loading, view, onReload,
}: { clinics: ConsultantClinic[]; loading: boolean; view: "list" | "card"; onReload: () => void }) {
  const [modalState, setModalState] = useState<{ mode: "create" } | { mode: "edit"; clinic: ConsultantClinic } | null>(null);

  async function toggleActive(clinic: ConsultantClinic) {
    try {
      await directoryApi.put(`/consultant-clinics/${clinic.id}`, {
        name: clinic.name,
        address: clinic.address,
        city: clinic.city,
        state: clinic.state,
        country: clinic.country,
        leadContactName: clinic.leadContactName,
        leadContactPhone: clinic.leadContactPhone,
        status: clinic.status === 0 ? 1 : 0,
      });
      onReload();
    } catch {
      // reload on next action will reflect true server state
    }
  }

  const columns: Column<ConsultantClinic>[] = [
    { key: "name", header: "Clinic / Hospital", render: (c) => <span className="font-semibold text-ink-900">{c.name}</span> },
    { key: "lead", header: "Lead Contact", render: (c) => (c.leadContactName ? `${c.leadContactName} (${c.leadContactPhone ?? "—"})` : "—") },
    { key: "city", header: "Location", render: (c) => [c.city, c.state].filter(Boolean).join(", ") || "—" },
    {
      key: "status",
      header: "Status",
      render: (c) => (
        <div className="flex items-center gap-2">
          <Toggle checked={c.status === 0} onChange={() => toggleActive(c)} size="sm" />
          <Badge tone={statusTone(c.status === 0 ? "Active" : "Inactive")}>{c.status === 0 ? "Active" : "Inactive"}</Badge>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (c) => (
        <button
          onClick={() => setModalState({ mode: "edit", clinic: c })}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"
        >
          <Edit2 size={14} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModalState({ mode: "create" })}>
          Add Clinic
        </Button>
      </div>

      {view === "list" ? (
        <Card>
          <DataTable columns={columns} data={clinics} searchKeys={["name", "city"]} rowKey={(c) => c.id} emptyLabel={loading ? "Loading…" : "No consultant clinics yet"} />
        </Card>
      ) : clinics.length === 0 && !loading ? (
        <Card><CardBody className="text-center text-sm text-ink-700/50">No consultant clinics yet.</CardBody></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clinics.map((c) => (
            <Card key={c.id}>
              <CardBody>
                <h3 className="font-bold text-ink-950">{c.name}</h3>
                <p className="mt-1 text-xs text-ink-700/50">{[c.city, c.state].filter(Boolean).join(", ") || "No location on file"}</p>
                {c.leadContactName && <p className="mt-1 text-xs text-ink-700/50">{c.leadContactName} · {c.leadContactPhone ?? "—"}</p>}
                <div className="mt-3 flex items-center justify-between border-t border-ink-900/[0.06] pt-3">
                  <Badge tone={statusTone(c.status === 0 ? "Active" : "Inactive")}>{c.status === 0 ? "Active" : "Inactive"}</Badge>
                  <div className="flex items-center gap-1">
                    <Toggle checked={c.status === 0} onChange={() => toggleActive(c)} size="sm" />
                    <button
                      onClick={() => setModalState({ mode: "edit", clinic: c })}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ClinicModal state={modalState} onClose={() => setModalState(null)} onSaved={onReload} />
    </div>
  );
}

function ClinicModal({
  state, onClose, onSaved,
}: {
  state: { mode: "create" } | { mode: "edit"; clinic: ConsultantClinic } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = state?.mode === "edit" ? state.clinic : null;
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [country, setCountry] = useState("India");
  const [leadContactName, setLeadContactName] = useState("");
  const [leadContactPhone, setLeadContactPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state) return;
    setName(editing?.name ?? "");
    setAddress(editing?.address ?? "");
    setCity(editing?.city ?? "");
    setStateVal(editing?.state ?? "");
    setCountry(editing?.country ?? "India");
    setLeadContactName(editing?.leadContactName ?? "");
    setLeadContactPhone(editing?.leadContactPhone ?? "");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function submit() {
    if (!name) {
      setError("Clinic name is required.");
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      name,
      address: address || null,
      city: city || null,
      state: stateVal || null,
      country: country || null,
      leadContactName: leadContactName || null,
      leadContactPhone: leadContactPhone || null,
    };
    try {
      if (editing) {
        await directoryApi.put(`/consultant-clinics/${editing.id}`, { ...body, status: editing.status });
      } else {
        await directoryApi.post("/consultant-clinics", body);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this clinic.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={editing ? "Edit Consultant Clinic" : "Add Consultant Clinic"}
      subtitle="A partner hospital or clinic where consultant doctors see patients."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Clinic"}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Clinic / Hospital Name" required className="sm:col-span-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Apollo Cradle" />
        <Input label="Lead Contact Name" value={leadContactName} onChange={(e) => setLeadContactName(e.target.value)} />
        <Input label="Lead Contact Phone" value={leadContactPhone} onChange={(e) => setLeadContactPhone(e.target.value)} />
        <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <Input label="State" value={stateVal} onChange={(e) => setStateVal(e.target.value)} />
        <Input label="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
        <Input label="Address" className="sm:col-span-2" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </Modal>
  );
}

// ================= Doctors =================

function DoctorsTab({
  doctors, services, clinics, loading, view, onReload,
}: {
  doctors: ConsultantDoctor[]; services: ConsultantService[]; clinics: ConsultantClinic[];
  loading: boolean; view: "list" | "card"; onReload: () => void;
}) {
  const [modalState, setModalState] = useState<{ mode: "create" } | { mode: "edit"; doctor: ConsultantDoctor } | null>(null);
  const serviceNameById = useMemo(() => new Map(services.map((s) => [s.id, s.name])), [services]);
  const clinicNameById = useMemo(() => new Map(clinics.map((c) => [c.id, c.name])), [clinics]);

  async function toggleActive(doctor: ConsultantDoctor) {
    try {
      await directoryApi.put(`/consultant-doctors/${doctor.id}`, doctorToBody(doctor, doctor.status === 0 ? 1 : 0));
      onReload();
    } catch {
      // reload on next action will reflect true server state
    }
  }

  function clinicBadges(clinicIds: string[]) {
    const names = clinicIds.map((id) => clinicNameById.get(id) ?? "Unknown");
    const shown = names.slice(0, 2);
    const rest = names.length - shown.length;
    return (
      <div className="flex flex-wrap gap-1">
        {shown.map((n) => <Badge key={n} tone="brand" dot={false}>{n}</Badge>)}
        {rest > 0 && <Badge tone="neutral" dot={false}>+{rest} more</Badge>}
        {names.length === 0 && <span className="text-xs text-ink-700/40">No clinics</span>}
      </div>
    );
  }

  const columns: Column<ConsultantDoctor>[] = [
    {
      key: "name",
      header: "Doctor",
      render: (d) => (
        <div className="flex items-center gap-3">
          <Avatar name={d.name} color="#0d9488" size={34} photoUrl={d.photoUrl ?? undefined} />
          <div>
            <div className="font-semibold text-ink-900">{d.name}</div>
            {d.qualification && <div className="text-xs text-ink-700/45">{d.qualification}</div>}
          </div>
        </div>
      ),
    },
    { key: "service", header: "Service", render: (d) => <Badge tone="brand">{serviceNameById.get(d.consultantServiceId) ?? "Unknown"}</Badge> },
    { key: "clinics", header: "Clinics", render: (d) => clinicBadges(d.clinicIds) },
    { key: "fee", header: "Fee", align: "right", render: (d) => <span className="font-semibold">{formatCurrency(d.consultationFee)}</span> },
    {
      key: "status",
      header: "Status",
      render: (d) => (
        <div className="flex items-center gap-2">
          <Toggle checked={d.status === 0} onChange={() => toggleActive(d)} size="sm" />
          <Badge tone={statusTone(d.status === 0 ? "Active" : "Inactive")}>{d.status === 0 ? "Active" : "Inactive"}</Badge>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (d) => (
        <button
          onClick={() => setModalState({ mode: "edit", doctor: d })}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"
        >
          <Edit2 size={14} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          variant="primary"
          icon={<Plus size={15} />}
          onClick={() => setModalState({ mode: "create" })}
          disabled={services.length === 0}
        >
          Add Doctor
        </Button>
      </div>
      {services.length === 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
          Add at least one Service before adding a doctor.
        </div>
      )}

      {view === "list" ? (
        <Card>
          <DataTable columns={columns} data={doctors} searchKeys={["name"]} rowKey={(d) => d.id} emptyLabel={loading ? "Loading…" : "No consultant doctors yet"} />
        </Card>
      ) : doctors.length === 0 && !loading ? (
        <Card><CardBody className="text-center text-sm text-ink-700/50">No consultant doctors yet.</CardBody></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {doctors.map((d) => (
            <Card key={d.id}>
              <CardBody>
                <div className="flex items-center gap-3">
                  <Avatar name={d.name} color="#0d9488" size={44} photoUrl={d.photoUrl ?? undefined} />
                  <div>
                    <h3 className="font-bold text-ink-950">{d.name}</h3>
                    <p className="text-xs text-ink-700/50">{serviceNameById.get(d.consultantServiceId) ?? "Unknown service"}</p>
                  </div>
                </div>
                <div className="mt-3">{clinicBadges(d.clinicIds)}</div>
                <div className="mt-2 text-sm font-semibold text-ink-900">{formatCurrency(d.consultationFee)}</div>
                <div className="mt-3 flex items-center justify-between border-t border-ink-900/[0.06] pt-3">
                  <Badge tone={statusTone(d.status === 0 ? "Active" : "Inactive")}>{d.status === 0 ? "Active" : "Inactive"}</Badge>
                  <div className="flex items-center gap-1">
                    <Toggle checked={d.status === 0} onChange={() => toggleActive(d)} size="sm" />
                    <button
                      onClick={() => setModalState({ mode: "edit", doctor: d })}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-700/50 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <DoctorModal state={modalState} onClose={() => setModalState(null)} onSaved={onReload} services={services} clinics={clinics} />
    </div>
  );
}

function doctorToBody(d: ConsultantDoctor, status: number) {
  return {
    name: d.name,
    consultantServiceId: d.consultantServiceId,
    consultationFee: d.consultationFee,
    mobile: d.mobile,
    email: d.email,
    gender: d.gender,
    licenseNumber: d.licenseNumber,
    qualification: d.qualification,
    experienceYears: d.experienceYears,
    photoUrl: d.photoUrl,
    dayOff: d.dayOff,
    clinicIds: d.clinicIds,
    sessionWindows: d.sessionWindows,
    status,
  };
}

interface WindowFormState {
  enabled: boolean;
  startTime: string;
  endTime: string;
  price: string;
}

const emptyWindows: WindowFormState[] = WINDOW_LABELS.map(() => ({ enabled: false, startTime: "09:00", endTime: "11:00", price: "" }));

function DoctorModal({
  state, onClose, onSaved, services, clinics,
}: {
  state: { mode: "create" } | { mode: "edit"; doctor: ConsultantDoctor } | null;
  onClose: () => void;
  onSaved: () => void;
  services: ConsultantService[];
  clinics: ConsultantClinic[];
}) {
  const editing = state?.mode === "edit" ? state.doctor : null;
  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [fee, setFee] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [qualification, setQualification] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [dayOff, setDayOff] = useState("");
  const [clinicIds, setClinicIds] = useState<string[]>([]);
  const [windows, setWindows] = useState<WindowFormState[]>(emptyWindows);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state) return;
    setName(editing?.name ?? "");
    setServiceId(editing?.consultantServiceId ?? "");
    setFee(editing ? String(editing.consultationFee) : "");
    setMobile(editing?.mobile ?? "");
    setEmail(editing?.email ?? "");
    setGender(editing?.gender ?? "");
    setLicenseNumber(editing?.licenseNumber ?? "");
    setQualification(editing?.qualification ?? "");
    setExperienceYears(editing?.experienceYears != null ? String(editing.experienceYears) : "");
    setPhotoUrl(editing?.photoUrl ?? "");
    setDayOff(editing?.dayOff != null ? String(editing.dayOff) : "");
    setClinicIds(editing?.clinicIds ?? []);
    if (editing) {
      const byName = new Map(editing.sessionWindows.map((w) => [w.windowName, w]));
      setWindows(
        WINDOW_LABELS.map((_, i) => {
          const w = byName.get(i);
          return w
            ? { enabled: true, startTime: w.startTime.slice(0, 5), endTime: w.endTime.slice(0, 5), price: String(w.pricePerSession) }
            : { enabled: false, startTime: "09:00", endTime: "11:00", price: "" };
        })
      );
    } else {
      setWindows(emptyWindows);
    }
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function toggleClinic(id: string) {
    setClinicIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function updateWindow(index: number, patch: Partial<WindowFormState>) {
    setWindows((ws) => ws.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  }

  async function submit() {
    if (!name || !serviceId || !fee) {
      setError("Name, service and fee are all required.");
      return;
    }
    for (const w of windows) {
      if (w.enabled && w.endTime <= w.startTime) {
        setError("Each enabled session window's end time must be after its start time.");
        return;
      }
    }
    setSaving(true);
    setError("");
    const body = {
      name,
      consultantServiceId: serviceId,
      consultationFee: Number(fee),
      mobile: mobile || null,
      email: email || null,
      gender: gender || null,
      licenseNumber: licenseNumber || null,
      qualification: qualification || null,
      experienceYears: experienceYears ? Number(experienceYears) : null,
      photoUrl: photoUrl || null,
      dayOff: dayOff !== "" ? Number(dayOff) : null,
      clinicIds,
      sessionWindows: windows
        .map((w, i) => ({ windowName: i, startTime: `${w.startTime}:00`, endTime: `${w.endTime}:00`, pricePerSession: Number(w.price) || 0, enabled: w.enabled }))
        .filter((w) => w.enabled)
        .map(({ enabled: _enabled, ...rest }) => rest),
    };
    try {
      if (editing) {
        await directoryApi.put(`/consultant-doctors/${editing.id}`, { ...body, status: editing.status });
      } else {
        await directoryApi.post("/consultant-doctors", body);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this doctor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={editing ? "Edit Consultant Doctor" : "Add Consultant Doctor"}
      subtitle="An external doctor who sees patients under one consultant service, at one or more partner clinics."
      width="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Doctor"}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Doctor Name" required className="sm:col-span-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. Ananya Rao" />
        <Select
          label="Consultant Service"
          required
          placeholder="Select service"
          options={services.map((s) => ({ label: s.name, value: s.id }))}
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
        />
        <Input label="Consultation Fee (₹)" type="number" required value={fee} onChange={(e) => setFee(e.target.value)} />
        <Input label="Mobile Number" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Select
          label="Gender"
          placeholder="Not specified"
          options={[{ label: "Male", value: "Male" }, { label: "Female", value: "Female" }, { label: "Other", value: "Other" }]}
          value={gender}
          onChange={(e) => setGender(e.target.value)}
        />
        <Select
          label="Day Off"
          placeholder="Not set"
          options={DAY_LABELS.map((label, i) => ({ label, value: String(i) }))}
          value={dayOff}
          onChange={(e) => setDayOff(e.target.value)}
        />
        <Input label="License Number" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
        <Input label="Qualification" value={qualification} onChange={(e) => setQualification(e.target.value)} placeholder="e.g. MD, DM Neurology" />
        <Input label="Experience (years)" type="number" min="0" max="100" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} />
        <Input label="Photo URL" className="sm:col-span-2" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />

        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-ink-700">Clinics</label>
          <p className="mt-0.5 text-[11px] text-ink-700/50">Select every clinic this doctor practices at.</p>
          <div className="mt-1.5 flex max-h-36 flex-col gap-1.5 overflow-y-auto rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-ink-900/10">
            {clinics.length === 0 && <span className="text-xs text-ink-700/40">No clinics yet — add one first.</span>}
            {clinics.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-ink-800">
                <input
                  type="checkbox"
                  checked={clinicIds.includes(c.id)}
                  onChange={() => toggleClinic(c.id)}
                  className="h-3.5 w-3.5 rounded accent-brand-600"
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-ink-700">Session Timing</label>
          <p className="mt-0.5 text-[11px] text-ink-700/50">Enable and configure whichever session windows this doctor holds consultations in.</p>
          <div className="mt-1.5 flex flex-col gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-ink-900/10">
            {WINDOW_LABELS.map((label, i) => (
              <div key={label} className="flex flex-wrap items-center gap-2">
                <label className="flex w-28 shrink-0 items-center gap-2 text-sm font-medium text-ink-800">
                  <input
                    type="checkbox"
                    checked={windows[i].enabled}
                    onChange={(e) => updateWindow(i, { enabled: e.target.checked })}
                    className="h-3.5 w-3.5 rounded accent-brand-600"
                  />
                  {label}
                </label>
                <input
                  type="time"
                  disabled={!windows[i].enabled}
                  value={windows[i].startTime}
                  onChange={(e) => updateWindow(i, { startTime: e.target.value })}
                  className="h-8 rounded-lg bg-white px-2 text-xs ring-1 ring-inset ring-ink-900/10 outline-none focus:ring-brand-400 disabled:opacity-40"
                />
                <span className="text-xs text-ink-700/40">to</span>
                <input
                  type="time"
                  disabled={!windows[i].enabled}
                  value={windows[i].endTime}
                  onChange={(e) => updateWindow(i, { endTime: e.target.value })}
                  className="h-8 rounded-lg bg-white px-2 text-xs ring-1 ring-inset ring-ink-900/10 outline-none focus:ring-brand-400 disabled:opacity-40"
                />
                <input
                  type="number"
                  placeholder="₹ per session"
                  disabled={!windows[i].enabled}
                  value={windows[i].price}
                  onChange={(e) => updateWindow(i, { price: e.target.value })}
                  className="h-8 w-32 rounded-lg bg-white px-2 text-xs ring-1 ring-inset ring-ink-900/10 outline-none focus:ring-brand-400 disabled:opacity-40"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </Modal>
  );
}
