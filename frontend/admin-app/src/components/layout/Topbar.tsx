import { useState } from "react";
import { Bell, Menu, Search, ChevronDown, LogOut, User, Settings } from "lucide-react";
import { useAuthStore, useUiStore } from "@/store/authStore";
import { Avatar } from "@/components/ui/Avatar";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { allNavItems } from "@/lib/nav";

export function Topbar() {
  const { name, userType, logout } = useAuthStore();
  const { setMobileNavOpen } = useUiStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const current = allNavItems.find((i) => location.pathname.startsWith(i.path));

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-900/[0.06] bg-white/80 px-4 backdrop-blur-xl sm:px-6">
      <button
        onClick={() => setMobileNavOpen(true)}
        className="rounded-lg p-2 text-ink-700 hover:bg-ink-900/5 lg:hidden"
      >
        <Menu size={19} />
      </button>

      <div className="hidden flex-col leading-tight sm:flex">
        <span className="text-[15px] font-bold text-ink-950">{current?.label ?? "Dashboard"}</span>
        <span className="text-[11px] text-ink-700/45">Bimba Pro / CDC Connect &middot; Admin Web Console</span>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="relative hidden md:block">
          <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-700/35" />
          <input
            placeholder="Quick search..."
            className="h-9 w-56 rounded-xl bg-slate-100 pl-9 pr-3 text-sm outline-none ring-1 ring-inset ring-transparent transition-all placeholder:text-ink-700/35 focus:bg-white focus:ring-brand-400/60 lg:w-72"
          />
        </div>

        <button className="relative flex h-9 w-9 items-center justify-center rounded-xl text-ink-700 transition-colors hover:bg-ink-900/5">
          <Bell size={17} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        <div className="relative">
          <button
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-ink-900/5"
          >
            <Avatar name={name} color="#4f46e5" size={32} />
            <div className="hidden text-left leading-tight sm:block">
              <div className="text-[13px] font-bold text-ink-900">{name}</div>
              <div className="text-[10px] font-medium text-ink-700/45">{userType ?? "Admin"}</div>
            </div>
            <ChevronDown size={14} className="hidden text-ink-700/40 sm:block" />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl bg-white p-1.5 shadow-2xl ring-1 ring-ink-900/10"
                >
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <Avatar name={name} color="#4f46e5" size={36} />
                    <div className="leading-tight">
                      <div className="text-sm font-bold text-ink-900">{name}</div>
                      <div className="text-[11px] text-ink-700/45">Super Admin</div>
                    </div>
                  </div>
                  <div className="my-1 h-px bg-ink-900/[0.06]" />
                  <MenuItem icon={<User size={15} />} label="My Profile" />
                  <MenuItem icon={<Settings size={15} />} label="Settings" />
                  <div className="my-1 h-px bg-ink-900/[0.06]" />
                  <MenuItem icon={<LogOut size={15} />} label="Sign out" danger onClick={logout} />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

function MenuItem({ icon, label, danger, onClick }: { icon: React.ReactNode; label: string; danger?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors ${
        danger ? "text-rose-600 hover:bg-rose-50" : "text-ink-700 hover:bg-ink-900/5"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
