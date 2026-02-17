import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { PRIMARY_NAV, SECONDARY_NAV } from "@/constants/navigation";
import { useLanguage } from "@/context/LanguageContext";
import type { ActivePage } from "@/types/navigation";

interface SidebarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useLanguage();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 264 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="relative flex h-screen flex-col border-r border-stone-200/70 bg-white"
      style={{ boxShadow: "1px 0 8px rgba(42, 37, 32, 0.03)" }}
    >
      {/* ── Brand ── */}
      <div className="flex h-[72px] items-center gap-3 border-b border-stone-200/50 px-5">
        {/* Logo Mark */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden"
          style={{ boxShadow: "0 2px 8px rgba(184, 146, 92, 0.3)" }}>
          <img src="/docia-icon.jpg" alt="DocIA" className="w-full h-full object-cover" />
        </div>

        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col overflow-hidden"
            >
              <span className="text-[18px] font-semibold tracking-tight text-stone-900"
                style={{ fontFamily: "'Playfair Display', serif" }}>
                Doc<span className="text-tan-600">IA</span>
              </span>
              <span className="text-[10px] font-medium tracking-[0.08em] text-stone-400 uppercase">
                Document Intelligence
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Primary Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-3 px-3 text-[10px] font-semibold tracking-[0.1em] text-stone-400 uppercase"
            >
              Navigation
            </motion.p>
          )}
        </AnimatePresence>

        <div className="space-y-0.5">
          {PRIMARY_NAV.map((item) => {
            const isActive = activePage === item.id;
            const Icon = item.icon;
            return (
              <motion.button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                whileHover={{ x: collapsed ? 0 : 2 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors duration-200",
                  isActive
                    ? "text-coffee-800"
                    : "text-stone-500 hover:text-stone-700"
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-tan-50 border border-tan-200/60"
                    style={{ boxShadow: "0 1px 3px rgba(184, 146, 92, 0.08)" }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}

                <Icon
                  className={cn(
                    "relative z-10 h-[18px] w-[18px] shrink-0 transition-colors duration-200",
                    isActive ? "text-tan-600" : "text-stone-400 group-hover:text-stone-500"
                  )}
                />

                <AnimatePresence mode="wait">
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="relative z-10 whitespace-nowrap"
                    >
                      {t(item.label)}
                    </motion.span>
                  )}
                </AnimatePresence>

                {item.badge && !collapsed && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="relative z-10 ml-auto rounded-md bg-tan-100 px-2 py-0.5 text-[10px] font-semibold text-tan-700 border border-tan-200/50"
                  >
                    {t(item.badge)}
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* ── Secondary Nav ── */}
      <div className="border-t border-stone-200/50 px-3 py-3">
        {SECONDARY_NAV.map((item) => {
          const isActive = activePage === item.id;
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              whileHover={{ x: collapsed ? 0 : 2 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors duration-200",
                isActive
                  ? "bg-stone-100/80 text-stone-800"
                  : "text-stone-400 hover:bg-stone-50 hover:text-stone-600"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0 text-stone-400 group-hover:text-stone-500 transition-colors" />
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="whitespace-nowrap"
                  >
                    {t(item.label)}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>



      {/* ── Collapse Button ── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[80px] z-20 flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-white transition-colors hover:bg-cream-100"
        style={{ boxShadow: "0 1px 4px rgba(42, 37, 32, 0.08)" }}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-stone-500" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-stone-500" />
        )}
      </button>
    </motion.aside>
  );
}
