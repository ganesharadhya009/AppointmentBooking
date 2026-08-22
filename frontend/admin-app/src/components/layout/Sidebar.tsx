import { NavLink } from "react-router-dom";
import { navGroups } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { ChevronsLeft } from "lucide-react";
import { useUiStore } from "@/store/authStore";
import { motion } from "framer-motion";

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNavOpen } = useUiStore();

  return (
    <>
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-gradient-to-b from-ink-950 via-ink-900 to-[#161233] transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          sidebarCollapsed ? "lg:w-[76px]" : "lg:w-[260px]",
          "w-[260px]",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.06]" />
        <div className={cn("relative flex items-center gap-2.5 px-5 py-6", sidebarCollapsed && "lg:justify-center lg:px-0")}>
          <img src="/logo.webp" alt="BimBa" className="h-9 w-9 shrink-0 rounded-xl object-contain" />
          {!sidebarCollapsed && (
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-white">BimBa&#8209;Pro</div>
              <div className="text-[10px] font-medium text-white/40">Admin Console</div>
            </div>
          )}
        </div>

        <nav className="relative flex-1 overflow-y-auto px-3 pb-4 scrollbar-none">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-5">
              {!sidebarCollapsed && (
                <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-white/30">
                  {group.label}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all",
                        sidebarCollapsed && "lg:justify-center lg:px-0",
                        isActive ? "text-white" : "text-white/50 hover:bg-white/5 hover:text-white/85"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId="nav-active"
                            className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-500/90 to-brand-500/50 shadow-[0_4px_16px_-4px_rgba(99,102,241,0.6)]"
                            transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                          />
                        )}
                        <item.icon size={17} className="relative shrink-0" strokeWidth={2} />
                        {!sidebarCollapsed && <span className="relative truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative hidden border-t border-white/[0.06] p-3 lg:block">
          <button
            onClick={toggleSidebar}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-white/40 transition-colors hover:bg-white/5 hover:text-white/80"
          >
            <ChevronsLeft size={15} className={cn("transition-transform", sidebarCollapsed && "rotate-180")} />
            {!sidebarCollapsed && "Collapse"}
          </button>
        </div>
      </aside>
    </>
  );
}
