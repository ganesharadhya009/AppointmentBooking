import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ScrollToTopButton } from "./ScrollToTopButton";
import { AnimatePresence, motion } from "framer-motion";

export function AppShell() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="scroll-region" className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mx-auto w-full max-w-[1400px]"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
          <ScrollToTopButton />
        </main>
      </div>
    </div>
  );
}
