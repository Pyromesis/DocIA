import { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { AICompanion } from "@/components/companion/AICompanion";
import { DashboardPage } from "@/components/pages/DashboardPage";
import { DataVaultPage } from "@/components/pages/DataVaultPage";
import { TemplatesPage } from "@/components/pages/TemplatesPage";
import { UploadScanPage } from "@/components/pages/UploadScanPage";
import { DocumentsPage } from "@/components/pages/DocumentsPage";
import { HistoryPage } from "@/components/pages/HistoryPage";
import { AnalyticsPage } from "@/components/pages/AnalyticsPage";
import { ProjectsPage } from "@/components/pages/ProjectsPage";
import { EnhanceDocumentPage } from "@/components/pages/EnhanceDocumentPage";
import { TrainingPage } from "@/components/pages/TrainingPage";
import { HelpPage } from "@/components/pages/HelpPage";
import SettingsPage from "@/components/pages/SettingsPage";
import { LanguageProvider } from "@/context/LanguageContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { ActivePage } from "@/types/navigation";

// Mobile menu context so Header can toggle sidebar
interface MobileMenuContextType {
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}
export const MobileMenuContext = createContext<MobileMenuContextType>({
  isMobileMenuOpen: false,
  setMobileMenuOpen: () => { },
});
export const useMobileMenu = () => useContext(MobileMenuContext);

function AppContent() {
  const [activePage, setActivePage] = useState<ActivePage>("dashboard");
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <DashboardPage />;
      case "data-vault":
        return <DataVaultPage />;
      case "templates":
        return <TemplatesPage />;
      case "upload":
        return <UploadScanPage />;
      case "documents":
        return <DocumentsPage />;
      case "history":
        return <HistoryPage />;
      case "analytics":
        return <AnalyticsPage />;
      case "projects":
        return <ProjectsPage />;
      case "enhance":
        return <EnhanceDocumentPage />;
      case "training":
        return <TrainingPage />;
      case "settings":
        return <SettingsPage />;
      case "help":
        return <HelpPage />;
      default:
        return <DashboardPage />;
    }
  };

  const handleNavigate = (page: ActivePage) => {
    setActivePage(page);
    setMobileMenuOpen(false); // Close mobile menu on navigation
  };

  return (
    <MobileMenuContext.Provider value={{ isMobileMenuOpen, setMobileMenuOpen }}>
      <div className="flex h-screen bg-cream-50">
        {/* ── Desktop Sidebar (hidden on mobile) ── */}
        <div className="hidden md:block">
          <Sidebar activePage={activePage} onNavigate={handleNavigate} />
        </div>

        {/* ── Mobile Sidebar Overlay ── */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />
              {/* Sidebar Drawer */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="fixed inset-y-0 left-0 z-50 w-[280px] md:hidden"
              >
                <Sidebar activePage={activePage} onNavigate={handleNavigate} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Main Content ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header activePage={activePage} />

          <main className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="mx-auto max-w-7xl"
              >
                <ErrorBoundary>
                  {renderPage()}
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <AICompanion />
      </div>
    </MobileMenuContext.Provider>
  );
}

export function App() {
  return (
    <LanguageProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </LanguageProvider>
  );
}

