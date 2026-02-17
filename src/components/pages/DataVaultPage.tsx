/**
 * DataVaultPage — Local-first data management interface.
 * Import / Export / Wipe with full visibility into browser storage.
 */
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Download,
  Upload,
  Trash2,
  Database,
  FileText,
  Layers,
  FolderOpen,
  Activity,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  Eye,
  Server,
} from "lucide-react";
import { useDatabase } from "@/hooks/useDatabase";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

export function DataVaultPage() {
  const {
    stats,
    isLoading,
    isExporting,
    isImporting,
    isWiping,
    error,
    successMessage,
    handleExport,
    handleImport,
    handleWipe,
    clearMessages,
  } = useDatabase();

  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleImport(file);
      e.target.value = "";
    }
  };

  const confirmWipe = async () => {
    await handleWipe();
    setShowWipeConfirm(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-[65vh] items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="h-8 w-8 rounded-full border-2 border-stone-200 border-t-tan-500"
        />
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-7">
      {/* ── Notification Banners ── */}
      <AnimatePresence>
        {(error || successMessage) && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${
              error
                ? "border-rose-200/60 bg-rose-50/80 text-rose-700"
                : "border-sage-200/60 bg-sage-50/80 text-sage-700"
            }`}
          >
            <div className="flex items-center gap-3">
              {error ? (
                <AlertTriangle className="h-4 w-4 text-rose-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-sage-500" />
              )}
              <span className="text-[13px] font-medium">{error || successMessage}</span>
            </div>
            <button onClick={clearMessages} className="rounded-lg p-1 transition-colors hover:bg-white/50">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Privacy Banner ── */}
      <motion.div
        variants={fadeUp}
        className="relative overflow-hidden rounded-2xl border border-stone-200/50 p-7"
        style={{
          background: "linear-gradient(135deg, #3D3731 0%, #2A2520 50%, #1A1613 100%)",
          boxShadow: "0 4px 20px rgba(42, 37, 32, 0.12)",
        }}
      >
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-tan-500/30 bg-tan-500/15">
              <ShieldCheck className="h-6 w-6 text-tan-400" />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-cream-100 tracking-tight">
                Local-First Data Vault
              </h2>
              <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-stone-400">
                All your data lives exclusively in this browser's IndexedDB. Nothing is sent to any server.
                Export backups anytime, import to restore, or wipe everything instantly.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-sage-400" />
            <span className="text-[11px] font-medium text-sage-400 whitespace-nowrap">100% Client-Side</span>
          </div>
        </div>

        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle, rgba(184,146,92,0.5) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }} />
      </motion.div>

      {/* ── Storage Stats ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Documents", value: stats?.totalDocuments ?? 0, icon: FileText, color: "text-tan-500", bg: "bg-tan-50", border: "border-tan-200/50" },
          { label: "Templates", value: stats?.totalTemplates ?? 0, icon: Layers, color: "text-coffee-500", bg: "bg-coffee-50", border: "border-coffee-200/50" },
          { label: "Projects", value: stats?.totalProjects ?? 0, icon: FolderOpen, color: "text-stone-500", bg: "bg-stone-50", border: "border-stone-200/50" },
          { label: "Activities", value: stats?.totalActivities ?? 0, icon: Activity, color: "text-sage-500", bg: "bg-sage-50", border: "border-sage-200/50" },
          { label: "Completed", value: stats?.completedDocs ?? 0, icon: CheckCircle2, color: "text-sage-500", bg: "bg-sage-50", border: "border-sage-200/50" },
          { label: "Estimated Size", value: stats?.storageEstimate ?? "0 B", icon: HardDrive, color: "text-tan-500", bg: "bg-tan-50", border: "border-tan-200/50" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              className="rounded-2xl border border-stone-200/50 bg-white p-4"
              style={{ boxShadow: "0 1px 4px rgba(42, 37, 32, 0.04)" }}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.bg} border ${stat.border}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <p className="mt-3 text-[22px] font-bold tracking-tight text-stone-900">{stat.value}</p>
              <p className="mt-0.5 text-[11px] font-medium text-stone-400 uppercase tracking-wide">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* ── Data Operations ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Export */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-stone-200/50 bg-white p-6"
          style={{ boxShadow: "0 1px 4px rgba(42, 37, 32, 0.04)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tan-50 border border-tan-200/50">
              <Download className="h-5 w-5 text-tan-600" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-stone-800">Export Backup</h3>
              <p className="text-[11px] text-stone-400">Download a .json snapshot</p>
            </div>
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-stone-500">
            Creates a complete backup of all documents, templates, projects, and preferences as a timestamped JSON file. 
            Includes a checksum for integrity verification.
          </p>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExport}
            disabled={isExporting}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-tan-400 to-tan-500 px-4 py-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ boxShadow: "0 2px 8px rgba(184, 146, 92, 0.25)" }}
          >
            {isExporting ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting ? "Exporting…" : "Export Database"}
          </motion.button>
        </motion.div>

        {/* Import */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-stone-200/50 bg-white p-6"
          style={{ boxShadow: "0 1px 4px rgba(42, 37, 32, 0.04)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-coffee-50 border border-coffee-200/50">
              <Upload className="h-5 w-5 text-coffee-600" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-stone-800">Import Backup</h3>
              <p className="text-[11px] text-stone-400">Restore from a .json file</p>
            </div>
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-stone-500">
            Upload a previously exported DocIA backup file. The import will verify the checksum, 
            replace all current data, and restore the full session.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={onFileSelect}
            className="hidden"
          />
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-coffee-300/60 bg-coffee-50/30 px-4 py-3 text-[13px] font-semibold text-coffee-700 transition-all hover:border-coffee-400/80 hover:bg-coffee-50/60 disabled:opacity-60"
          >
            {isImporting ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="h-4 w-4 rounded-full border-2 border-coffee-300 border-t-coffee-600" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isImporting ? "Importing…" : "Select Backup File"}
          </motion.button>
        </motion.div>

        {/* Wipe */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-stone-200/50 bg-white p-6"
          style={{ boxShadow: "0 1px 4px rgba(42, 37, 32, 0.04)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 border border-rose-200/50">
              <Trash2 className="h-5 w-5 text-rose-500" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-stone-800">Wipe All Data</h3>
              <p className="text-[11px] text-stone-400">Instantly clear browser storage</p>
            </div>
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-stone-500">
            Permanently deletes all documents, templates, projects, preferences, and activity logs 
            from this browser. This action cannot be undone.
          </p>

          <AnimatePresence mode="wait">
            {!showWipeConfirm ? (
              <motion.button
                key="wipe-button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowWipeConfirm(true)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200/60 bg-white px-4 py-3 text-[13px] font-semibold text-rose-600 transition-all hover:bg-rose-50 hover:border-rose-300"
              >
                <Trash2 className="h-4 w-4" />
                Wipe All Data
              </motion.button>
            ) : (
              <motion.div
                key="wipe-confirm"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="mt-5 space-y-2"
              >
                <p className="text-[12px] font-semibold text-rose-600 text-center">
                  ⚠️ Are you absolutely sure?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowWipeConfirm(false)}
                    className="rounded-xl border border-stone-200/60 bg-white px-3 py-2.5 text-[12px] font-medium text-stone-600 transition-colors hover:bg-cream-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmWipe}
                    disabled={isWiping}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-500 px-3 py-2.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {isWiping ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {isWiping ? "Wiping…" : "Confirm"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── Privacy Architecture ── */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl border border-stone-200/50 bg-white p-7"
        style={{ boxShadow: "0 1px 4px rgba(42, 37, 32, 0.04)" }}
      >
        <div className="flex items-center gap-2.5 mb-5">
          <Database className="h-4 w-4 text-tan-500" />
          <h3 className="text-[14px] font-semibold text-stone-800 tracking-tight">Privacy Architecture</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: Lock,
              title: "Zero Network Calls",
              desc: "No data leaves your browser. All processing metadata, extracted text, and preferences live in IndexedDB — a browser-native, sandboxed database.",
              color: "text-tan-600",
              bg: "bg-tan-50",
              border: "border-tan-200/50",
            },
            {
              icon: Eye,
              title: "Full Transparency",
              desc: "Export your entire dataset as human-readable JSON at any time. Every field is inspectable — no hidden data, no telemetry, no tracking.",
              color: "text-coffee-600",
              bg: "bg-coffee-50",
              border: "border-coffee-200/50",
            },
            {
              icon: Server,
              title: "Instant Purge",
              desc: "One-click wipe erases all data from the browser instantly. No residual caches, no server-side copies. Your data, your control.",
              color: "text-sage-600",
              bg: "bg-sage-50",
              border: "border-sage-200/50",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className={`rounded-xl border ${card.border} ${card.bg} p-5`}
              >
                <Icon className={`h-5 w-5 ${card.color}`} />
                <h4 className="mt-3 text-[13px] font-semibold text-stone-800">{card.title}</h4>
                <p className="mt-2 text-[12px] leading-relaxed text-stone-500">{card.desc}</p>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
