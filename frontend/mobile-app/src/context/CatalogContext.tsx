import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { directoryApi, ApiError, PagedResult } from '../lib/apiClient';
import { Branch, ConsultingDoctor, Therapist, Therapy } from '../types';

// Raw shapes mirror the real directory-api DTOs (see services/directory-api/DirectoryApi/Dtos).
interface RawBranch {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  isActive: boolean;
}

interface RawTherapyType {
  id: string;
  name: string;
  status: number; // TherapyTypeStatus: Active=0, Inactive=1, Deleted=2
  branchIds: string[];
}

interface RawAssignment {
  id: string;
  branchId: string;
  therapyTypeId: string;
  sessionWindows: { pricePerSession: number }[];
}

interface RawTherapist {
  id: string;
  name: string;
  designation: string;
  status: number; // TherapistStatus: Active=0, Inactive=1, Deleted=2
  assignments: RawAssignment[];
}

interface RawConsultantService {
  id: string;
  name: string;
  status: number; // ConsultantStatus: Active=0, Inactive=1
}

interface RawConsultantClinic {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  status: number;
}

interface RawSessionWindow {
  windowName: number;
  startTime: string;
  endTime: string;
}

interface RawConsultantDoctor {
  id: string;
  name: string;
  consultantServiceId: string;
  consultationFee: number;
  qualification: string | null;
  experienceYears: number | null;
  status: number;
  clinicIds: string[];
  sessionWindows: RawSessionWindow[];
}

function formatTimings(windows: RawSessionWindow[]): string {
  if (windows.length === 0) return 'Timings not specified';
  return windows
    .slice()
    .sort((a, b) => a.windowName - b.windowName)
    .map((w) => `${w.startTime.slice(0, 5)} - ${w.endTime.slice(0, 5)}`)
    .join(', ');
}

interface CatalogContextValue {
  branches: Branch[];
  therapies: Therapy[];
  therapists: Therapist[];
  consultingDoctors: ConsultingDoctor[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined);

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [therapies, setTherapies] = useState<Therapy[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [consultingDoctors, setConsultingDoctors] = useState<ConsultingDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [branchRes, therapyRes, therapistRes, serviceRes, clinicRes, doctorRes] = await Promise.all([
          directoryApi.get<PagedResult<RawBranch>>('/branches', { pageSize: 100 }),
          directoryApi.get<PagedResult<RawTherapyType>>('/therapy-types', { pageSize: 100 }),
          directoryApi.get<PagedResult<RawTherapist>>('/therapists', { pageSize: 100 }),
          directoryApi.get<PagedResult<RawConsultantService>>('/consultant-services', { pageSize: 100 }),
          directoryApi.get<PagedResult<RawConsultantClinic>>('/consultant-clinics', { pageSize: 100 }),
          directoryApi.get<PagedResult<RawConsultantDoctor>>('/consultant-doctors', { pageSize: 100 }),
        ]);
        if (cancelled) return;

        setBranches(
          branchRes.items
            .filter((b) => b.isActive)
            .map((b) => ({ id: b.id, name: b.name, city: b.city ?? '', address: b.address ?? '' }))
        );

        // TherapyType is one record with many branchIds -- flatten to one row per branch so the
        // existing branch-scoped screens (which expect a single branchId per Therapy) keep working.
        const therapyRows: Therapy[] = [];
        for (const t of therapyRes.items) {
          if (t.status !== 0) continue;
          for (const branchId of t.branchIds) {
            therapyRows.push({
              id: `${t.id}:${branchId}`,
              name: t.name,
              branchId,
              icon: 'medkit',
              description: `${t.name} sessions available at this branch.`,
            });
          }
        }
        setTherapies(therapyRows);

        const therapyNameById = new Map(therapyRes.items.map((t) => [t.id, t.name]));
        const therapistRows: Therapist[] = [];
        for (const th of therapistRes.items) {
          if (th.status !== 0) continue;
          for (const a of th.assignments) {
            therapistRows.push({
              id: `${th.id}:${a.id}`,
              name: th.name,
              designation: th.designation,
              therapyId: `${a.therapyTypeId}:${a.branchId}`,
              branchId: a.branchId,
              experienceYears: 0,
              rating: 0,
              specialties: [therapyNameById.get(a.therapyTypeId) ?? th.designation],
              sessionPrice: a.sessionWindows[0]?.pricePerSession,
            });
          }
        }
        setTherapists(therapistRows);

        const serviceNameById = new Map(serviceRes.items.map((s) => [s.id, s.name]));
        const clinicById = new Map(clinicRes.items.map((c) => [c.id, c]));
        const doctorRows: ConsultingDoctor[] = [];
        for (const d of doctorRes.items) {
          if (d.status !== 0) continue;
          const clinics = d.clinicIds.map((id) => clinicById.get(id)).filter((c): c is RawConsultantClinic => !!c);
          const targets = clinics.length > 0 ? clinics : [null];
          for (const clinic of targets) {
            doctorRows.push({
              id: clinic ? `${d.id}:${clinic.id}` : d.id,
              name: d.name,
              qualifications: d.qualification ?? 'Qualification not listed',
              specialty: serviceNameById.get(d.consultantServiceId) ?? 'General Consultation',
              experienceYears: d.experienceYears ?? 0,
              rating: 0,
              fee: d.consultationFee,
              clinicName: clinic?.name ?? 'Clinic not specified',
              clinicCity: clinic?.city ?? '',
              clinicAddress: clinic?.address ?? '',
              timings: formatTimings(d.sessionWindows),
              verified: true,
            });
          }
        }
        setConsultingDoctors(doctorRows);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load catalog data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const value = useMemo(
    () => ({
      branches,
      therapies,
      therapists,
      consultingDoctors,
      loading,
      error,
      reload: () => setReloadKey((k) => k + 1),
    }),
    [branches, therapies, therapists, consultingDoctors, loading, error]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
}
