/**
 * HistoryPage — Activity log for all user actions.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, Layers, Trash2, Upload, Settings, Download, ScanLine, RefreshCw } from 'lucide-react';
import { db } from '../../db/schema';
import { useLanguage } from '../../context/LanguageContext';

const ACTION_ICONS: Record<string, any> = {
    process: ScanLine,
    upload: Upload,
    template_create: Layers,
    export: Download,
    import: Upload,
    wipe: Trash2,
    settings: Settings,
};

const ACTION_COLORS: Record<string, string> = {
    process: 'bg-blue-50 text-blue-500 border-blue-200',
    upload: 'bg-tan-50 text-tan-600 border-tan-200',
    template_create: 'bg-purple-50 text-purple-500 border-purple-200',
    export: 'bg-sage-50 text-sage-500 border-sage-200',
    import: 'bg-emerald-50 text-emerald-500 border-emerald-200',
    wipe: 'bg-rose-50 text-rose-500 border-rose-200',
    settings: 'bg-stone-50 text-stone-500 border-stone-200',
};

export function HistoryPage() {
    const [limit, setLimit] = useState(50);
    const { t } = useLanguage();

    const logs = useLiveQuery(
        () => db.activityLogs.orderBy('timestamp').reverse().limit(limit).toArray(),
        [limit]
    );
    const isLoading = logs === undefined;

    const formatDate = (ts: number) => {
        const date = new Date(ts);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        if (isToday) return `${t('history.today')}, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        if (isYesterday) return `${t('history.yesterday')}, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
            `, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };

    const handleClearHistory = async () => {
        if (confirm(t('history.confirmClear'))) {
            await db.activityLogs.clear();
        }
    };

    if (isLoading) {
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

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 font-display">{t('history.title')}</h1>
                    <p className="text-gray-500 mt-1">{t('history.subtitle')}</p>
                </div>
                {logs && logs.length > 0 && (
                    <button
                        onClick={handleClearHistory}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-rose-500 bg-gray-50 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                        <Trash2 size={12} /> {t('history.clearAll')}
                    </button>
                )}
            </div>

            {!logs || logs.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-[50vh] text-center"
                >
                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                        <Clock className="w-7 h-7 text-stone-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">{t('history.noHistory')}</h3>
                    <p className="text-sm text-gray-400 max-w-sm">
                        {t('history.noHistoryDesc')}
                    </p>
                </motion.div>
            ) : (
                <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

                    <div className="space-y-1">
                        {logs.map((log, i) => {
                            const Icon = ACTION_ICONS[log.action] || Clock;
                            const colors = ACTION_COLORS[log.action] || 'bg-gray-50 text-gray-500 border-gray-200';
                            return (
                                <motion.div
                                    key={log.id || i}
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                    className="flex items-start gap-4 pl-1 py-2.5 group"
                                >
                                    <div className={`relative z-10 p-2 rounded-lg border ${colors}`}>
                                        <Icon size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-800">{log.entityName}</span>
                                            <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                                {log.entityType}
                                            </span>
                                        </div>
                                        {log.details && (
                                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{log.details}</p>
                                        )}
                                        <p className="text-[10px] text-gray-400 mt-1">{formatDate(log.timestamp)}</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {logs.length >= limit && (
                        <div className="text-center pt-4">
                            <button
                                onClick={() => setLimit(l => l + 50)}
                                className="flex items-center gap-2 mx-auto text-xs text-[#7C5C3F] hover:text-[#5A452E] font-medium"
                            >
                                <RefreshCw size={12} />
                                {t('history.loadMore')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
