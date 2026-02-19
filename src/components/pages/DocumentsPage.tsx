/**
 * DocumentsPage — Browse, search, and manage all scanned documents stored in IndexedDB.
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';

import { FileText, Search, Trash2, Download, Clock, CheckCircle2, ChevronDown, FileType } from 'lucide-react';
import { db } from '../../db/schema';
import { useLanguage } from '../../context/LanguageContext';

export function DocumentsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [selectedDoc, setSelectedDoc] = useState<any>(null);
    const [downloadMenuOpenId, setDownloadMenuOpenId] = useState<number | null>(null);
    const { t } = useLanguage();

    const allDocs = useLiveQuery(() => db.documents.orderBy('createdAt').reverse().toArray());
    const isLoading = allDocs === undefined;

    const filteredDocs = useMemo(() => {
        if (!allDocs) return [];
        return allDocs.filter(doc => {
            const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (doc.content && doc.content.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [allDocs, searchQuery, filterStatus]);

    const handleDelete = async (id: number) => {
        if (confirm(t('documents.confirmDelete'))) {
            await db.documents.delete(id);
            if (selectedDoc?.id === id) setSelectedDoc(null);
        }
    };

    /** Normalize a string for variable matching: strip accents, lowercase, snake_case */
    const normalizeVar = (s: string): string =>
        s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');

    /** Replace {{variables}} in template HTML using normalized matching */
    const replaceTemplateVars = (raw: string, fields: { label: string; value: string }[]): string => {
        const fieldMap = new Map<string, string>();
        fields.forEach(f => {
            const val = f.value || '';
            fieldMap.set(normalizeVar(f.label), val);
            fieldMap.set(f.label.toLowerCase(), val);
            fieldMap.set(f.label, val);
        });
        return raw.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, varName: string) => {
            if (fieldMap.has(varName)) return fieldMap.get(varName)!;
            if (fieldMap.has(varName.toLowerCase())) return fieldMap.get(varName.toLowerCase())!;
            const norm = normalizeVar(varName);
            if (fieldMap.has(norm)) return fieldMap.get(norm)!;
            for (const [key, val] of fieldMap.entries()) {
                if (normalizeVar(key) === norm) return val;
            }
            return '___';
        });
    };

    /** CSS reset that removes browser defaults so template inline styles take priority */
    const TEMPLATE_CSS_RESET = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      p, div, span, h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; line-height: inherit; }
      body { margin: 0; padding: 0; color: #000; }
      table { border-collapse: collapse; }
    `;

    const handleExportWord = async (doc: any) => {
        let htmlBody = '';
        let css = '';
        let isFullDocument = false;
        let hasTemplate = false;

        if (doc.templateId) {
            const tpl = await db.templates.get(doc.templateId);
            if (tpl?.schema?.htmlContent) {
                hasTemplate = true;
                let raw = tpl.schema.htmlContent as string;
                if (doc.metadata?.fields) {
                    raw = replaceTemplateVars(raw, doc.metadata.fields);
                }
                if (raw.includes('<html') || raw.includes('<!DOCTYPE') || raw.includes('<HTML')) {
                    htmlBody = raw;
                    isFullDocument = true;
                } else {
                    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
                    let styleMatch;
                    while ((styleMatch = styleRegex.exec(raw)) !== null) {
                        css += styleMatch[1] + '\n';
                    }
                    htmlBody = raw.replace(styleRegex, '');
                }
            }
        }

        if (!htmlBody) {
            htmlBody = `<h1 style="font-size:22px; margin-bottom:16px; color:#1a1a1a; border-bottom:2px solid #B8925C; padding-bottom:8px;">${doc.name}</h1>`;
            if (doc.metadata?.summary) {
                htmlBody += `<p style="font-size:11px; color:#666; margin-bottom:20px;">${doc.metadata.summary}</p>`;
            }
            if (doc.metadata?.fields?.length > 0) {
                htmlBody += `<table style="border-collapse:collapse; width:100%; border:1px solid #e0e0e0;">
                    <tr style="background:#f8f6f3;"><th style="padding:10px 12px; text-align:left; border:1px solid #e0e0e0; font-size:10pt; color:#555;">Campo</th><th style="padding:10px 12px; text-align:left; border:1px solid #e0e0e0; font-size:10pt; color:#555;">Valor</th></tr>`;
                doc.metadata.fields.forEach((f: any) => {
                    htmlBody += `<tr><td style="padding:8px 12px; border:1px solid #e0e0e0; font-weight:600;">${f.label}</td><td style="padding:8px 12px; border:1px solid #e0e0e0;">${f.value || ''}</td></tr>`;
                });
                htmlBody += `</table>`;
            }
            if (doc.content) {
                htmlBody += `<h2 style="font-size:16px; color:#333; margin-top:24px;">Contenido Completo</h2><p style="font-size:10px; white-space:pre-wrap; color:#444;">${doc.content}</p>`;
            }
        }

        let fullDoc: string;
        if (isFullDocument) {
            fullDoc = htmlBody.replace(/<html/i, "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'");
        } else if (hasTemplate) {
            // Template fragment — use CSS reset so inline styles are the ONLY styles
            fullDoc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>${doc.name}</title>
            <style>
                @page { margin: 1in; size: letter; }
                ${TEMPLATE_CSS_RESET}
                ${css}
            </style>
            </head><body>${htmlBody}</body></html>`;
        } else {
            fullDoc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>${doc.name}</title>
            <style>
                @page { margin: 1in; size: letter; }
                body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #000; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                ${css}
            </style>
            </head><body>${htmlBody}</body></html>`;
        }

        const blob = new Blob(['\ufeff', fullDoc], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${doc.name}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setDownloadMenuOpenId(null);
    };

    const handleExportPDF = async (doc: any) => {
        try {
            let htmlBody = '';
            let css = '';
            let isFullDocument = false;
            let hasTemplate = false;

            if (doc.templateId) {
                const tpl = await db.templates.get(doc.templateId);
                if (tpl?.schema?.htmlContent) {
                    hasTemplate = true;
                    let raw = tpl.schema.htmlContent as string;
                    if (doc.metadata?.fields) {
                        raw = replaceTemplateVars(raw, doc.metadata.fields);
                    }
                    if (raw.includes('<html') || raw.includes('<!DOCTYPE') || raw.includes('<HTML')) {
                        htmlBody = raw;
                        isFullDocument = true;
                    } else {
                        const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
                        let styleMatch;
                        while ((styleMatch = styleRegex.exec(raw)) !== null) {
                            css += styleMatch[1] + '\n';
                        }
                        htmlBody = raw.replace(styleRegex, '');
                    }
                }
            }

            if (!htmlBody) {
                htmlBody = `<div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">`;
                htmlBody += `<h1 style="color: #1a1a1a; font-size: 20pt; margin-bottom: 8px; border-bottom: 2px solid #B8925C; padding-bottom: 8px;">${doc.name}</h1>`;
                if (doc.metadata?.summary) {
                    htmlBody += `<p style="color: #666; font-size: 10pt; margin-bottom: 24px;">${doc.metadata.summary}</p>`;
                }
                if (doc.metadata?.fields?.length > 0) {
                    htmlBody += `<table style="border-collapse: collapse; width: 100%; border: 1px solid #e0e0e0;">
                        <thead><tr style="background: #f8f6f3;">
                            <th style="text-align:left; padding:10px 12px; border:1px solid #e0e0e0; font-size:10pt; color:#555;">Campo</th>
                            <th style="text-align:left; padding:10px 12px; border:1px solid #e0e0e0; font-size:10pt; color:#555;">Valor</th>
                        </tr></thead><tbody>`;
                    doc.metadata.fields.forEach((f: any) => {
                        htmlBody += `<tr><td style="padding:8px 12px; border:1px solid #e0e0e0; font-weight:600; color:#333;">${f.label}</td><td style="padding:8px 12px; border:1px solid #e0e0e0; color:#1a1a1a;">${f.value || ''}</td></tr>`;
                    });
                    htmlBody += `</tbody></table>`;
                }
                if (doc.content) {
                    htmlBody += `<h2 style="font-size:14pt; color:#333; margin-top:24px;">Contenido Completo</h2><p style="font-size:9pt; white-space:pre-wrap; color:#444;">${doc.content}</p>`;
                }
                htmlBody += `<p style="color:#999; font-size:8pt; margin-top:24px; text-align:right;">Generado por DocIA</p></div>`;
            }

            // Build the full HTML page for the PDF
            let pdfHTML: string;
            if (isFullDocument) {
                pdfHTML = htmlBody;
            } else if (hasTemplate) {
                pdfHTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
                    <style>${TEMPLATE_CSS_RESET} ${css}</style>
                </head><body>${htmlBody}</body></html>`;
            } else {
                pdfHTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #000; margin: 0; padding: 0; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                        * { box-sizing: border-box; }
                        ${css}
                    </style>
                </head><body>${htmlBody}</body></html>`;
            }

            // Create iframe for rendering (html2canvas needs visible elements)
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.left = '0';
            iframe.style.top = '0';
            iframe.style.width = '8.5in';
            iframe.style.height = '11in';
            iframe.style.opacity = '0';
            iframe.style.pointerEvents = 'none';
            iframe.style.zIndex = '-9999';
            document.body.appendChild(iframe);

            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (!iframeDoc) throw new Error('Could not access iframe document');
                iframeDoc.open();
                iframeDoc.write(pdfHTML);
                iframeDoc.close();

                await new Promise(resolve => setTimeout(resolve, 300));

                const contentEl = iframeDoc.body;
                if (!contentEl || !contentEl.innerHTML.trim()) throw new Error('No content to render');

                const html2pdf = (await import('html2pdf.js')).default;
                await html2pdf().set({
                    margin: [0.5, 0.6, 0.5, 0.6],
                    filename: `${doc.name}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, logging: false },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
                    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
                } as any).from(contentEl).save();
            } catch (pdfErr) {
                console.error('html2pdf failed, falling back to print:', pdfErr);
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(pdfHTML);
                    printWindow.document.close();
                    setTimeout(() => printWindow.print(), 500);
                }
            } finally {
                document.body.removeChild(iframe);
            }

            setDownloadMenuOpenId(null);
        } catch (e) {
            console.error("PDF Export Error:", e);
            alert("Error al exportar PDF");
        }
    };

    const timeAgo = (ts: number) => {
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60_000);
        if (mins < 1) return t('documents.timeAgo.justNow');
        if (mins < 60) return t('documents.timeAgo.minutesAgo').replace('{n}', String(mins));
        const hours = Math.floor(mins / 60);
        if (hours < 24) return t('documents.timeAgo.hoursAgo').replace('{n}', String(hours));
        const days = Math.floor(hours / 24);
        if (days < 30) return t('documents.timeAgo.daysAgo').replace('{n}', String(days));
        return new Date(ts).toLocaleDateString();
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-sage-50 text-sage-600 rounded-full border border-sage-200"><CheckCircle2 size={10} />{t('documents.completed')}</span>;
            case 'processing':
                return <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-200"><Clock size={10} />{t('documents.processing')}</span>;
            default:
                return <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full border border-gray-200">{status}</span>;
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1_048_576).toFixed(1)} MB`;
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
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-gray-900 font-display">{t('documents.title')}</h1>
                <p className="text-gray-500 mt-1">{t('header.documents.subtitle')}</p>
            </div>

            {/* Search & Filters */}
            <div className="flex gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('documents.search')}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-[#B8925C] focus:ring-2 focus:ring-[#B8925C]/20 transition-all"
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="pl-3 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-[#B8925C] focus:ring-2 focus:ring-[#B8925C]/20 transition-all"
                >
                    <option value="all">{t('documents.all')}</option>
                    <option value="completed">{t('documents.completed')}</option>
                    <option value="processing">{t('documents.processing')}</option>
                </select>
            </div>

            {/* Documents Grid */}
            {filteredDocs.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-[50vh] text-center"
                >
                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                        <FileText className="w-7 h-7 text-stone-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                        {allDocs?.length === 0 ? t('documents.noDocuments') : t('documents.noDocuments')}
                    </h3>
                    <p className="text-sm text-gray-400 max-w-sm">
                        {allDocs?.length === 0
                            ? t('documents.noDocumentsDesc')
                            : t('documents.noDocumentsDesc')}
                    </p>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredDocs.map((doc, i) => (
                        <motion.div
                            key={doc.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className={`bg-white rounded-xl border p-4 hover:shadow-md transition-all cursor-pointer ${selectedDoc?.id === doc.id ? 'border-[#B8925C] ring-2 ring-[#B8925C]/10' : 'border-gray-200'
                                }`}
                            onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
                        >
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-stone-100 rounded-lg shrink-0">
                                    <FileText className="w-5 h-5 text-stone-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="text-sm font-semibold text-gray-800 truncate">{doc.name}</h3>
                                        {statusBadge(doc.status)}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                                        <span>{doc.type?.toUpperCase()}</span>
                                        <span>•</span>
                                        <span>{formatSize(doc.size)}</span>
                                        <span>•</span>
                                        <span>{timeAgo(doc.createdAt)}</span>
                                    </div>

                                    {/* Preview of content */}
                                    {doc.content && (
                                        <p className="mt-2 text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                            {String(doc.content).slice(0, 150)}...
                                        </p>
                                    )}

                                    {/* Extracted fields preview */}
                                    {doc.metadata?.fields && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {doc.metadata.fields.slice(0, 3).map((field, fi) => (
                                                <span key={fi} className="text-[9px] font-mono px-1.5 py-0.5 bg-tan-50 text-tan-600 rounded border border-tan-200/50">
                                                    {field.label}
                                                </span>
                                            ))}
                                            {doc.metadata.fields.length > 3 && (
                                                <span className="text-[9px] text-gray-400">+{doc.metadata.fields.length - 3} {t('documents.fields')}</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="mt-3 flex items-center gap-2">
                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDownloadMenuOpenId(downloadMenuOpenId === doc.id ? null : (doc.id || null)); }}
                                                className={`flex items-center gap-1 text-[11px] transition-colors rounded-md px-2 py-1 ${downloadMenuOpenId === doc.id ? 'bg-[#7C5C3F] text-white' : 'text-gray-500 hover:text-[#7C5C3F] hover:bg-stone-50'}`}
                                            >
                                                <Download size={12} /> {t('documents.export')} <ChevronDown size={10} />
                                            </button>

                                            {downloadMenuOpenId === doc.id && (
                                                <div className="absolute top-full left-0 mt-1 w-32 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleExportPDF(doc); }}
                                                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-[#7C5C3F]/10 hover:text-[#7C5C3F] flex items-center gap-2"
                                                    >
                                                        <FileText size={12} /> PDF
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleExportWord(doc); }}
                                                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-[#7C5C3F]/10 hover:text-[#7C5C3F] flex items-center gap-2"
                                                    >
                                                        <FileType size={12} /> Word
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(doc.id!); }}
                                            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-rose-500 transition-colors"
                                        >
                                            <Trash2 size={12} /> {t('documents.delete')}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded detail view */}
                            <AnimatePresence>
                                {selectedDoc?.id === doc.id && doc.metadata?.fields && Array.isArray(doc.metadata.fields) && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-4 pt-3 border-t border-gray-100">
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('upload.extractedFields')}</p>
                                            <div className="space-y-1.5">
                                                {doc.metadata.fields.map((field, fi) => (
                                                    <div key={fi} className="flex items-start justify-between gap-2 text-xs p-2 bg-gray-50 rounded-lg">
                                                        <span className="font-medium text-gray-600">{field.label}</span>
                                                        <span className="text-gray-800 text-right">{field.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {doc.metadata.summary && (
                                                <div className="mt-3 p-2 bg-tan-50 rounded-lg text-xs text-stone-600">
                                                    <strong>{t('upload.summary')}:</strong> {String(doc.metadata.summary)}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Footer stats */}
            {allDocs && allDocs.length > 0 && (
                <div className="text-center text-xs text-gray-400 pt-4">
                    {filteredDocs.length} / {allDocs.length} {t('documents.title').toLowerCase()} • {t('header.local')}
                </div>
            )}
        </div>
    );
}
