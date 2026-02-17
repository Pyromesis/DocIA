/**
 * DashboardPage — Live data from local IndexedDB.
 * All numbers are real, pulled from the browser database.
 */
import { motion } from "framer-motion";
import {
  Upload,
  FileText,
  FolderOpen,
  Layers,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Plus
} from "lucide-react";
import { useDatabase } from "../../hooks/useDatabase";
import { useLanguage } from "../../context/LanguageContext";

/* ─── Animation Variants ─── */
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export function DashboardPage() {
  const { stats, recentDocs, isLoading } = useDatabase();
  const { t } = useLanguage();

  if (isLoading || !stats) {
    return (
      <div className="flex h-[65vh] items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="h-8 w-8 rounded-full border-2 border-stone-200 border-t-docia-coffee"
        />
      </div>
    );
  }

  // Zero-State Logic
  const isEmpty = stats.totalDocuments === 0 && stats.totalTemplates === 0;

  if (isEmpty) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center justify-center h-[70vh] text-center max-w-lg mx-auto"
      >
        <div className="w-24 h-24 bg-gradient-to-br from-docia-coffee/10 to-docia-coffee/5 rounded-full flex items-center justify-center mb-8 border border-docia-coffee/20">
          <Upload className="w-10 h-10 text-docia-coffee" />
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-4 tracking-tight">
          {t('dashboard.title')}
        </h2>

        <p className="text-lg text-gray-500 mb-8 leading-relaxed">
          {t('dashboard.zeroState')}
        </p>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-8 py-3 bg-docia-coffee text-white rounded-full font-medium shadow-lg hover:bg-docia-coffee-dark transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          {t('dashboard.upload')}
        </motion.button>

        {/* Subtle Privacy Notice */}
        <div className="mt-12 flex items-center gap-2 text-sage-500 text-xs font-medium bg-sage-50 px-4 py-2 rounded-full">
          <ShieldCheck size={14} />
          <span>{t('header.local')} — {t('dataVault.subtitle')}</span>
        </div>
      </motion.div>
    );
  }

  const statCards = [
    { label: t('dashboard.stats.documents'), value: stats.totalDocuments.toString(), change: `${stats.completedDocs} ${t('dashboard.stats.processed').toLowerCase()}`, icon: FileText, gradient: "from-docia-coffee-light to-docia-coffee" },
    { label: t('projects.title'), value: stats.totalProjects.toString(), icon: FolderOpen, gradient: "from-stone-400 to-stone-600" },
    { label: t('dashboard.stats.templates'), value: stats.totalTemplates.toString(), icon: Layers, gradient: "from-tan-400 to-tan-600" },
    { label: t('dashboard.stats.storage'), value: stats.storageEstimate, change: t('header.local'), icon: TrendingUp, gradient: "from-sage-400 to-sage-600" },
  ];

  const statusIcon = (status: string) => {
    if (status === "completed") return { Icon: CheckCircle2, color: "text-sage-500", label: t('documents.completed') };
    if (status === "processing") return { Icon: Clock, color: "text-docia-coffee", label: t('documents.processing') };
    return { Icon: Clock, color: "text-stone-400", label: t('documents.pending') };
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return t('documents.timeAgo.justNow');
    if (mins < 60) return t('documents.timeAgo.minutesAgo').replace('{n}', String(mins));
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('documents.timeAgo.hoursAgo').replace('{n}', String(hours));
    return t('documents.timeAgo.daysAgo').replace('{n}', String(Math.floor(hours / 24)));
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-7">
      {/* ── Privacy Ribbon ── */}
      <motion.div
        variants={fadeUp}
        className="flex items-center gap-3 rounded-2xl border border-sage-200/50 bg-sage-50/50 px-5 py-3"
      >
        <ShieldCheck className="h-4 w-4 text-sage-500" />
        <p className="text-[12px] text-sage-700 font-medium">
          {t('settings.about.privacy')}
        </p>
        <span className="ml-auto flex h-2 w-2 rounded-full bg-sage-400" />
      </motion.div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              whileHover={{ y: -3, transition: { duration: 0.25 } }}
              className="group relative overflow-hidden rounded-2xl border border-stone-200/50 bg-white p-5"
              style={{ boxShadow: "0 1px 4px rgba(42, 37, 32, 0.04)" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.06em] text-stone-400 uppercase">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-[28px] font-bold tracking-tight text-stone-900">
                    {stat.value}
                  </p>
                  {stat.change ? (
                    <div className="mt-1.5 flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3 text-sage-500" />
                      <span className="text-[11px] font-semibold text-sage-600">{stat.change}</span>
                    </div>
                  ) : null}
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${stat.gradient}`}
                  style={{ boxShadow: "0 2px 8px rgba(184, 146, 92, 0.15)" }}
                >
                  <Icon className="h-[18px] w-[18px] text-white" />
                </div>
              </div>
              <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-docia-coffee/0 transition-all duration-500 group-hover:bg-docia-coffee/5" />
            </motion.div>
          );
        })}
      </div>

      {/* ── Quick Actions + Recent Activity ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-stone-200/50 bg-white p-6"
          style={{ boxShadow: "0 1px 4px rgba(42, 37, 32, 0.04)" }}
        >
          <h3 className="text-[13px] font-semibold text-stone-800 tracking-tight">{t('dashboard.quickActions')}</h3>
          <div className="mt-4 space-y-3">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex w-full items-center gap-3.5 rounded-xl border-2 border-dashed border-docia-coffee/30 bg-docia-coffee/5 p-4 text-left transition-all hover:border-docia-coffee/50 hover:bg-docia-coffee/10"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-docia-coffee/10 border border-docia-coffee/20">
                <Upload className="h-[18px] w-[18px] text-docia-coffee" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-docia-coffee-dark">{t('dashboard.upload')}</p>
                <p className="text-[11px] text-stone-400">PDF, DOCX, Images</p>
              </div>
            </motion.button>
          </div>
        </motion.div>

        {/* Recent Documents from DB */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-stone-200/50 bg-white p-6 lg:col-span-2"
          style={{ boxShadow: "0 1px 4px rgba(42, 37, 32, 0.04)" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-stone-800 tracking-tight">{t('dashboard.activity')}</h3>
            <span className="text-[11px] font-medium text-stone-400">{t('header.local')}</span>
          </div>

          <div className="mt-4 space-y-0.5">
            {recentDocs.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-stone-400">{t('dashboard.noDocuments')}</p>
            ) : (
              recentDocs.map((doc, i) => {
                const st = statusIcon(doc.status);
                return (
                  <motion.div
                    key={doc.id ?? doc.name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                    className="group flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-stone-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 border border-stone-200/40">
                        <FileText className="h-4 w-4 text-stone-400" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-stone-700 group-hover:text-stone-900 transition-colors">
                          {doc.name}
                        </p>
                        <p className="text-[11px] text-stone-400">{timeAgo(doc.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <st.Icon className={`h-3.5 w-3.5 ${st.color}`} />
                      <span className={`text-[11px] font-medium ${st.color}`}>{st.label}</span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
