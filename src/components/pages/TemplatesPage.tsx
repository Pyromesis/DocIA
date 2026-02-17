import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../context/LanguageContext';
import { formalTemplates, FormalTemplate } from '../../data/formalTemplates';
import { TemplateCard } from '../templates/TemplateCard';
import { TemplateEditor } from '../template/TemplateEditor';
import {
  Globe, Languages, Loader2, CheckCircle2, Sparkles,
  ChevronDown, FileText, Brain, Trash2, GraduationCap, ArrowRight,
} from 'lucide-react';
import { loadAISettings, callChat, scanDocument } from '../../services/ai';
import { db } from '../../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { pdfBase64ToImage, pdfBase64ExtractText } from '../../services/pdfToImage';
import { generateFaithfulTemplate } from '../../services/pdfToTemplate';

// ── Available template languages ──
const TEMPLATE_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];

export const TemplatesPage: React.FC = () => {
  const { t } = useLanguage();
  const [selectedTemplate, setSelectedTemplate] = useState<FormalTemplate | null>(null);
  const [templateLanguages, setTemplateLanguages] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translateSuccess, setTranslateSuccess] = useState<string | null>(null);
  const [langDropdownOpen, setLangDropdownOpen] = useState<string | null>(null);

  // ── Upload & Scan State ──
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const base64 = (ev.target?.result as string).split(',')[1];
          const settings = await loadAISettings();

          // 1. Get Image (Pulse 1)
          const { base64: imageBase64, mimeType } = await pdfBase64ToImage(base64);

          // 2. AI Scan for fields (Pulse 2)
          const scanResult = await scanDocument(imageBase64, mimeType, settings);

          // 3. Text Extraction (Pulse 3)
          const textLayers = await pdfBase64ExtractText(base64);

          // 4. Faithful HTML Generation (Pulse 4)
          const faithful = await generateFaithfulTemplate(
            imageBase64,
            mimeType,
            textLayers,
            scanResult as any, // Cast to any to avoid type mismatch between files
            settings
          );

          // 5. Save as new template
          const newId = await db.templates.add({
            name: file.name.replace('.pdf', ''),
            description: 'Imported from PDF',
            category: 'Imported',
            createdAt: Date.now(),
            outputFormat: 'PDF',
            schema: {
              variables: faithful.variables,
              fields: scanResult.fields,
              htmlContent: faithful.html,
            },
          } as any);

          // 6. Open immediately
          const newTemplate = await db.templates.get(newId);
          if (newTemplate) {
            handleUserTemplateSelect(newTemplate);
          }
        } catch (err: any) {
          console.error(err);
          alert('Error processing PDF: ' + err.message);
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsUploading(false);
    }
  };

  // ── Translated templates cache (content replaced) ──
  const [translatedContents, setTranslatedContents] = useState<Record<string, string>>({});

  // ── User-created templates from DB (training) ──
  const userTemplates = useLiveQuery(() =>
    db.templates.orderBy('createdAt').reverse().toArray()
  ) || [];

  const handleDeleteUserTemplate = async (id: number) => {
    if (confirm(t('templates.confirmDelete') || '¿Eliminar esta plantilla?')) {
      await db.templates.delete(id);
    }
  };

  /** Convert a DB template into a FormalTemplate for the editor */
  const handleUserTemplateSelect = (tpl: typeof userTemplates[0]) => {
    const schema = tpl.schema as {
      variables?: string[];
      fields?: { label: string; value: string; confidence?: number }[];
      htmlContent?: string;
    };
    const variables = schema?.variables || [];
    const fields = schema?.fields || [];

    // If it was previously saved with HTML content, use that
    let content = schema?.htmlContent || '';

    // Otherwise generate HTML from the extracted fields
    if (!content && fields.length > 0) {
      content = generateTemplateHTML(tpl.name, tpl.description, fields, variables);
    }

    const formalTemplate: FormalTemplate = {
      id: `user-${tpl.id}`,
      name: tpl.name,
      category: 'AI Training',
      description: tpl.description,
      variables,
      format: tpl.outputFormat?.toUpperCase() || 'PDF',
      content,
    };
    setSelectedTemplate(formalTemplate);
  };

  /** Generate a nice HTML document from extracted fields */
  function generateTemplateHTML(
    name: string,
    description: string,
    fields: { label: string; value: string; confidence?: number }[],
    variables: string[]
  ): string {
    const fieldRows = fields
      .map(f => {
        const varName = `{{${f.label.toLowerCase().replace(/\s+/g, '_')}}}`;
        return `<tr>
          <td style="padding:8px 12px;font-weight:600;color:#4a4a4a;border-bottom:1px solid #eee;white-space:nowrap;">${f.label}</td>
          <td style="padding:8px 12px;color:#1a1a1a;border-bottom:1px solid #eee;">${varName}</td>
        </tr>`;
      })
      .join('\n');

    return `<div style="font-family:'Times New Roman',serif;max-width:700px;">
  <h1 style="font-size:22px;color:#333;border-bottom:2px solid #7C5C3F;padding-bottom:8px;margin-bottom:4px;">${name}</h1>
  <p style="color:#888;font-size:12px;margin-bottom:24px;">${description}</p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <thead>
      <tr style="background:#f8f6f3;">
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#7C5C3F;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #B8925C;">Campo</th>
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#7C5C3F;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #B8925C;">Valor / Variable</th>
      </tr>
    </thead>
    <tbody>
      ${fieldRows}
    </tbody>
  </table>

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #ddd;color:#aaa;font-size:11px;">
    <p>Variables disponibles: ${variables.join(', ')}</p>
    <p>Generado por DocIA — AI Training</p>
  </div>
</div>`;
  }

  const handleTemplateSelect = (id: string) => {
    const template = formalTemplates.find(t => t.id === id);
    if (template) {
      // If we have a translated version, use it
      if (translatedContents[id]) {
        setSelectedTemplate({
          ...template,
          content: translatedContents[id],
        });
      } else {
        setSelectedTemplate(template);
      }
    }
  };

  // ── AI Translation ──
  const handleTranslate = async (templateId: string, targetLang: string) => {
    const template = formalTemplates.find(t => t.id === templateId);
    if (!template) return;

    setTranslatingId(templateId);
    setLangDropdownOpen(null);

    try {
      const settings = await loadAISettings();
      const langName = TEMPLATE_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;

      const messages = [
        {
          role: 'system',
          content: `You are a professional document translator. Translate the following HTML template content to ${langName}. 
IMPORTANT RULES:
1. Keep ALL HTML tags, attributes, styles, and structure EXACTLY as they are
2. Only translate the text content inside the HTML elements
3. Keep all template variables like {{variable_name}} unchanged
4. Maintain the formal tone and professional language
5. Return ONLY the translated HTML, nothing else`
        },
        {
          role: 'user',
          content: template.content,
        }
      ];

      const translated = await callChat(messages, settings);

      // Cache the translated content
      setTranslatedContents(prev => ({ ...prev, [templateId]: translated }));
      setTemplateLanguages(prev => ({ ...prev, [templateId]: targetLang }));
      setTranslateSuccess(templateId);
      setTimeout(() => setTranslateSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Translation failed');
    } finally {
      setTranslatingId(null);
    }
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {selectedTemplate && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-50 bg-white"
          >
            <TemplateEditor
              template={selectedTemplate}
              onBack={() => setSelectedTemplate(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-10">
        <header className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('templates.title')}</h1>
            <p className="text-gray-500 max-w-2xl">{t('templates.subtitle')}</p>
          </div>

          <div className="flex gap-3">
            <input
              type="file"
              accept=".pdf"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-[#B8925C] text-white rounded-lg shadow-sm hover:bg-[#a07d4d] transition-colors disabled:opacity-70"
            >
              {isUploading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <FileText size={18} />
              )}
              {isUploading ? 'Procesando PDF...' : 'Importar PDF'}
            </button>
          </div>
        </header>

        {/* ── AI Translation Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-r from-[#7C5C3F]/5 via-[#B8925C]/5 to-[#7C5C3F]/5 rounded-2xl p-5 border border-[#B8925C]/15 flex items-center gap-4"
        >
          <div className="w-11 h-11 bg-gradient-to-br from-[#7C5C3F] to-[#B8925C] rounded-xl flex items-center justify-center shadow-md shrink-0">
            <Languages className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Sparkles size={14} className="text-[#B8925C]" />
              {t('templates.translateWith')}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('templates.selectLang')} — AI LLM
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {TEMPLATE_LANGUAGES.slice(0, 5).map((lang) => (
              <span
                key={lang.code}
                className="text-lg cursor-default"
                title={lang.name}
              >
                {lang.flag}
              </span>
            ))}
            <span className="text-xs text-gray-400 self-center ml-1">+{TEMPLATE_LANGUAGES.length - 5}</span>
          </div>
        </motion.div>

        {/* ═══ User-created Templates (from Training) ═══ */}
        {userTemplates.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="h-px bg-[#B8925C]/30 flex-grow"></div>
              <span className="text-sm font-semibold text-[#7C5C3F] uppercase tracking-wider px-3 bg-docia-bg flex items-center gap-2">
                <GraduationCap size={16} />
                {t('templates.myTemplates') || 'Mis Plantillas'}
              </span>
              <div className="h-px bg-[#B8925C]/30 flex-grow"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {userTemplates.map((tpl, index) => {
                const schema = tpl.schema as { variables?: string[]; fields?: { label: string; value: string }[] };
                const variables = schema?.variables || [];
                const fields = schema?.fields || [];

                return (
                  <motion.div
                    key={tpl.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className="bg-white rounded-xl border border-[#B8925C]/20 flex flex-col overflow-hidden group hover:shadow-lg hover:shadow-[#B8925C]/10 transition-all cursor-pointer"
                    onClick={() => handleUserTemplateSelect(tpl)}
                  >
                    {/* Preview area */}
                    <div className="h-32 bg-gradient-to-br from-[#7C5C3F]/5 via-[#B8925C]/5 to-amber-50 p-4 relative overflow-hidden">
                      <div className="space-y-1.5">
                        {fields.slice(0, 5).map((f, i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px]">
                            <span className="font-medium text-[#7C5C3F]/70 truncate max-w-[100px]">{f.label}:</span>
                            <span className="text-gray-400 truncate">{f.value?.slice(0, 30)}</span>
                          </div>
                        ))}
                        {fields.length > 5 && (
                          <span className="text-[9px] text-gray-400">+{fields.length - 5} más...</span>
                        )}
                      </div>
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#B8925C]/10 text-[#7C5C3F] border border-[#B8925C]/20">
                          <Brain size={10} className="inline mr-1" />
                          AI Training
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); tpl.id && handleDeleteUserTemplate(tpl.id); }}
                          className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title={t('templates.delete') || 'Eliminar'}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
                    </div>

                    <div className="p-5 flex flex-col flex-grow">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-[#B8925C]/10 rounded-lg text-[#7C5C3F]">
                            <FileText size={18} />
                          </div>
                        </div>
                      </div>

                      <h3 className="text-[15px] font-semibold text-gray-800 mb-1">{tpl.name}</h3>
                      <p className="text-[11px] text-gray-500 mb-3 flex-grow line-clamp-2 leading-relaxed">{tpl.description}</p>

                      <div className="mt-auto pt-3 border-t border-gray-50 space-y-3">
                        {variables.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {variables.slice(0, 3).map((v) => (
                              <span key={v} className="text-[9px] font-mono px-1.5 py-0.5 bg-[#B8925C]/10 text-[#7C5C3F] rounded border border-[#B8925C]/15">
                                {v}
                              </span>
                            ))}
                            {variables.length > 3 && (
                              <span className="text-[9px] px-1.5 py-0.5 text-stone-400">+{variables.length - 3}</span>
                            )}
                          </div>
                        )}
                        <p className="text-[9px] text-gray-400">
                          {new Date(tpl.createdAt).toLocaleDateString()} · {fields.length} {t('templates.fields') || 'campos'}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUserTemplateSelect(tpl); }}
                          className="w-full py-2.5 bg-white border border-[#7C5C3F]/30 text-[#7C5C3F] hover:bg-[#7C5C3F] hover:text-white rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-medium group-hover:bg-[#7C5C3F] group-hover:text-white"
                        >
                          {t('templates.editTemplate')}
                          <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Template Library */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px bg-gray-200 flex-grow"></div>
            <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider px-3 bg-docia-bg">
              {t('templates.formalSection')}
            </span>
            <div className="h-px bg-gray-200 flex-grow"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {formalTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="relative"
              >
                {/* Language selector ribbon */}
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                  {/* Current language badge */}
                  {templateLanguages[template.id] && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-[9px] font-bold px-1.5 py-0.5 bg-[#B8925C] text-white rounded-md shadow-sm"
                    >
                      {TEMPLATE_LANGUAGES.find(l => l.code === templateLanguages[template.id])?.flag}{' '}
                      {templateLanguages[template.id].toUpperCase()}
                    </motion.span>
                  )}

                  {/* Translate button */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLangDropdownOpen(langDropdownOpen === template.id ? null : template.id);
                      }}
                      disabled={translatingId === template.id}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all shadow-sm border
                        ${translatingId === template.id
                          ? 'bg-[#B8925C] text-white border-[#B8925C]'
                          : translateSuccess === template.id
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white/90 backdrop-blur-sm text-gray-600 border-gray-200/60 hover:border-[#B8925C]/50 hover:text-[#7C5C3F]'
                        }`}
                    >
                      {translatingId === template.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : translateSuccess === template.id ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        <Globe size={12} />
                      )}
                      {translatingId === template.id
                        ? t('templates.translating')
                        : translateSuccess === template.id
                          ? t('templates.translated')
                          : ''}
                      {!translatingId && translateSuccess !== template.id && (
                        <ChevronDown size={10} />
                      )}
                    </button>

                    {/* Language dropdown */}
                    <AnimatePresence>
                      {langDropdownOpen === template.id && (
                        <motion.div
                          initial={{ opacity: 0, y: -5, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -5, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-200/60 py-1.5 z-50 overflow-hidden"
                          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                        >
                          <div className="px-3 py-1.5 border-b border-gray-100">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              {t('templates.translateWith')}
                            </p>
                          </div>
                          <div className="max-h-60 overflow-y-auto py-1">
                            {TEMPLATE_LANGUAGES.map((lang) => (
                              <button
                                key={lang.code}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTranslate(template.id, lang.code);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-[#B8925C]/10 flex items-center gap-2.5 transition-colors"
                              >
                                <span className="text-base">{lang.flag}</span>
                                <span className="font-medium text-gray-700">{lang.name}</span>
                                {templateLanguages[template.id] === lang.code && (
                                  <CheckCircle2 size={14} className="ml-auto text-[#7C5C3F]" />
                                )}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <TemplateCard
                  template={{
                    ...template,
                    content: translatedContents[template.id] || template.content,
                  }}
                  onSelect={handleTemplateSelect}
                />
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      {/* Close dropdown when clicking outside */}
      {langDropdownOpen && (
        <div
          className="fixed inset-0 z-9"
          onClick={() => setLangDropdownOpen(null)}
        />
      )}
    </div>
  );
};
