import {
  LayoutDashboard, ListChecks, Building2, Stethoscope, Users, UserCog,
  Inbox, CalendarDays, FileBarChart, CalendarCheck, CalendarX, Baby,
  Image, Smartphone, ShieldCheck, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  num: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, num: "02" }],
  },
  {
    label: "Operations",
    items: [
      { label: "Activity Desk", path: "/activity", icon: ListChecks, num: "03" },
      { label: "Branches", path: "/branches", icon: Building2, num: "04" },
      { label: "Therapy Catalog", path: "/therapy", icon: Stethoscope, num: "05" },
      { label: "Multi-Therapist", path: "/therapists", icon: Users, num: "06" },
      { label: "Consultants", path: "/consultants", icon: UserCog, num: "07" },
      { label: "Enquiries", path: "/enquiries", icon: Inbox, num: "08" },
      { label: "Holidays", path: "/holidays", icon: CalendarDays, num: "09" },
    ],
  },
  {
    label: "Reporting",
    items: [
      { label: "Operational Reports", path: "/reports/operational", icon: FileBarChart, num: "10" },
      { label: "Appointment Reports", path: "/reports/appointments", icon: CalendarCheck, num: "11" },
      { label: "Cancellation Reports", path: "/reports/cancellations", icon: CalendarX, num: "12" },
    ],
  },
  {
    label: "Records",
    items: [{ label: "Clients & Children", path: "/clients", icon: Baby, num: "13" }],
  },
  {
    label: "Platform",
    items: [
      { label: "Banners & Posters", path: "/banners", icon: Image, num: "14" },
      { label: "App Versions", path: "/app-versions", icon: Smartphone, num: "15" },
      { label: "Admin Users", path: "/admin-users", icon: ShieldCheck, num: "16" },
    ],
  },
];

export const allNavItems = navGroups.flatMap((g) => g.items);
