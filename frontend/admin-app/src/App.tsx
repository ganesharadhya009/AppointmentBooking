import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { AppShell } from "@/components/layout/AppShell";
import Login from "@/pages/auth/Login";
import Dashboard from "@/pages/Dashboard";
import ActivityDesk from "@/pages/activity/ActivityDesk";
import BranchesPage from "@/pages/branches/BranchesPage";
import TherapyPage from "@/pages/therapy/TherapyPage";
import TherapistsPage from "@/pages/therapists/TherapistsPage";
import ConsultantsPage from "@/pages/consultants/ConsultantsPage";
import EnquiriesPage from "@/pages/enquiries/EnquiriesPage";
import HolidaysPage from "@/pages/holidays/HolidaysPage";
import OperationalReportsPage from "@/pages/reports/OperationalReportsPage";
import AppointmentReportsPage from "@/pages/reports/AppointmentReportsPage";
import CancellationReportsPage from "@/pages/reports/CancellationReportsPage";
import ClientsPage from "@/pages/clients/ClientsPage";
import BannersPage from "@/pages/banners/BannersPage";
import AppVersionsPage from "@/pages/appversions/AppVersionsPage";
import AdminUsersPage from "@/pages/admins/AdminUsersPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/activity" element={<ActivityDesk />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/therapy" element={<TherapyPage />} />
          <Route path="/therapists" element={<TherapistsPage />} />
          <Route path="/consultants" element={<ConsultantsPage />} />
          <Route path="/enquiries" element={<EnquiriesPage />} />
          <Route path="/holidays" element={<HolidaysPage />} />
          <Route path="/reports/operational" element={<OperationalReportsPage />} />
          <Route path="/reports/appointments" element={<AppointmentReportsPage />} />
          <Route path="/reports/cancellations" element={<CancellationReportsPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/banners" element={<BannersPage />} />
          <Route path="/app-versions" element={<AppVersionsPage />} />
          <Route path="/admin-users" element={<AdminUsersPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
