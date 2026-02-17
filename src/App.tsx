import { useState } from "react";
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

function AppContent() {
  const [activePage, setActivePage] = useState<ActivePage>("dashboard");

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

  return (
    <div className="flex h-screen bg-cream-50">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header activePage={activePage} />

        <main className="flex-1 overflow-y-auto px-8 py-7">
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
