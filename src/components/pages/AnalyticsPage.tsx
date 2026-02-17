/**
 * AnalyticsPage — Visual statistics about documents and usage.
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, FileText, Layers, TrendingUp, Calendar, HardDrive } from 'lucide-react';
import { db } from '../../db/schema';
import { useLanguage } from '../../context/LanguageContext';

const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function AnalyticsPage() {
    const docs = useLiveQuery(() => db.documents.toArray());
    const templates = useLiveQuery(() => db.templates.toArray());
    const logs = useLiveQuery(() => db.activityLogs.toArray());
    const isLoading = docs === undefined || templates === undefined || logs === undefined;
    const { t } = useLanguage();

    const analytics = useMemo(() => {
        if (!docs || !templates || !logs) return null;

        const totalDocs = docs.length;
        const totalTemplates = templates.length;
        const completedDocs = docs.filter(d => d.status === 'completed').length;
        const totalSize = docs.reduce((acc, d) => acc + (d.size || 0), 0);

        // Documents by type
        const byType: Record<string, number> = {};
        docs.forEach(d => {
            const type = d.type?.toUpperCase() || 'UNKNOWN';
            byType[type] = (byType[type] || 0) + 1;
        });

        // Activity over last 7 days
        const now = Date.now();
        const last7days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(now - (6 - i) * 86400000);
            const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
            const dayEnd = dayStart + 86400000;
            const count = logs.filter(l => l.timestamp >= dayStart && l.timestamp < dayEnd).length;
            return {
                label: date.toLocaleDateString([], { weekday: 'short' }),
                count,
            };
        });
        const maxActivity = Math.max(...last7days.map(d => d.count), 1);

        // Total extracted fields
        const totalFields = docs.reduce((acc, d) => {
            const fields = (d.metadata as any)?.fields;
            return acc + (Array.isArray(fields) ? fields.length : 0);
        }, 0);

        return { totalDocs, totalTemplates, completedDocs, totalSize, byType, last7days, maxActivity, totalFields };
    }, [docs, templates, logs]);

    if (isLoading || !analytics) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="h-8 w-8 rounded-full border-2 border-stone-200 border-t-[#7C5C3F]"
                />
            </div>
        );
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1_048_576).toFixed(1)} MB`;
    };

    const statCards = [
        { label: t('analytics.totalDocs'), value: analytics.totalDocs, icon: FileText, gradient: 'from-[#7C5C3F] to-[#B8925C]' },
        { label: t('analytics.completedScans'), value: analytics.completedDocs, icon: TrendingUp, gradient: 'from-sage-500 to-sage-600' },
        { label: t('analytics.savedTemplates'), value: analytics.totalTemplates, icon: Layers, gradient: 'from-purple-400 to-purple-600' },
        { label: t('analytics.fieldsExtracted'), value: analytics.totalFields, icon: BarChart3, gradient: 'from-blue-400 to-blue-600' },
    ];

    return (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-7 max-w-7xl mx-auto">
            <div>
                <h1 className="text-2xl font-semibold text-gray-900 font-display">{t('analytics.title')}</h1>
                <p className="text-gray-500 mt-1">{t('analytics.subtitle')}</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {statCards.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={stat.label}
                            variants={fadeUp}
                            className="bg-white rounded-2xl border border-gray-200/50 p-5 relative overflow-hidden"
                            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                                </div>
                                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient}`}>
                                    <Icon className="w-5 h-5 text-white" />
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Activity Chart */}
                <motion.div
                    variants={fadeUp}
                    className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/50 p-6"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-semibold text-gray-800">{t('analytics.activity7Days')}</h3>
                        <Calendar className="w-4 h-4 text-gray-400" />
                    </div>

                    {analytics.last7days.every(d => d.count === 0) ? (
                        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
                            {t('analytics.noActivity7')}
                        </div>
                    ) : (
                        <div className="flex items-end justify-between gap-3 h-40">
                            {analytics.last7days.map((day, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: `${(day.count / analytics.maxActivity) * 100}%` }}
                                        transition={{ delay: i * 0.1, duration: 0.5, ease: 'easeOut' }}
                                        className="w-full bg-gradient-to-t from-[#7C5C3F] to-[#B8925C] rounded-t-lg min-h-[4px] relative"
                                        style={{ minHeight: day.count > 0 ? '12px' : '4px' }}
                                    >
                                        {day.count > 0 && (
                                            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#7C5C3F]">
                                                {day.count}
                                            </span>
                                        )}
                                    </motion.div>
                                    <span className="text-[10px] text-gray-400 font-medium">{day.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Document Types Breakdown */}
                <motion.div
                    variants={fadeUp}
                    className="bg-white rounded-2xl border border-gray-200/50 p-6"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                >
                    <h3 className="text-sm font-semibold text-gray-800 mb-4">{t('analytics.documentTypes')}</h3>

                    {Object.keys(analytics.byType).length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
                            {t('analytics.noDocuments')}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(analytics.byType).map(([type, count], i) => {
                                const percentage = analytics.totalDocs > 0 ? (count / analytics.totalDocs) * 100 : 0;
                                return (
                                    <motion.div key={type} variants={fadeUp}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-gray-600">{type}</span>
                                            <span className="text-xs text-gray-500">{count} ({Math.round(percentage)}%)</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${percentage}%` }}
                                                transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                                                className="h-full bg-gradient-to-r from-[#B8925C] to-[#7C5C3F] rounded-full"
                                            />
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}

                    {/* Storage */}
                    <div className="mt-6 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <HardDrive size={12} />
                            <span>{t('analytics.localStorage')}: <strong className="text-gray-700">{formatSize(analytics.totalSize)}</strong></span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
