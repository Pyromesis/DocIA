import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    category: string;
    description: string;
    variables: string[];
    content?: string;
  };
  onSelect: (id: string) => void;
}

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  Employment: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  Legal: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  Finance: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  Business: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
};

export const TemplateCard: React.FC<TemplateCardProps> = ({ template, onSelect }) => {
  const { t } = useLanguage();
  const colors = categoryColors[template.category] || { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 12px 36px -12px rgba(0,0,0,0.12)" }}
      className="bg-white rounded-xl border border-gray-100 flex flex-col h-full overflow-hidden group cursor-pointer"
      onClick={() => onSelect(template.id)}
    >
      {/* Document Preview Miniature */}
      <div className="h-36 bg-gradient-to-b from-gray-50 to-gray-100/50 px-5 pt-4 overflow-hidden relative">
        <div className="bg-white rounded-t-md shadow-sm border border-gray-200/60 p-3 transform scale-[0.65] origin-top-left w-[154%]">
          {template.content ? (
            <div
              className="text-[10px] leading-[1.4] text-gray-500 max-h-[160px] overflow-hidden pointer-events-none"
              dangerouslySetInnerHTML={{ __html: template.content.slice(0, 500) }}
            />
          ) : (
            <div className="space-y-2">
              <div className="h-2 bg-gray-200 rounded w-3/4" />
              <div className="h-2 bg-gray-200 rounded w-full" />
              <div className="h-2 bg-gray-200 rounded w-5/6" />
              <div className="h-2 bg-gray-200 rounded w-2/3" />
            </div>
          )}
        </div>
        {/* Fade overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-100 to-transparent" />
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-tan-50 rounded-lg text-[#7C5C3F]">
              <FileText size={18} />
            </div>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
            {template.category}
          </span>
        </div>

        <h3 className="text-[15px] font-semibold text-gray-800 mb-1.5">{template.name}</h3>
        <p className="text-[12px] text-gray-500 mb-4 flex-grow leading-relaxed">{template.description}</p>

        <div className="mt-auto pt-3 border-t border-gray-50 space-y-3">
          <div className="flex flex-wrap gap-1">
            {template.variables.slice(0, 3).map((v) => (
              <span key={v} className="text-[9px] font-mono px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded border border-stone-200/50">
                {v}
              </span>
            ))}
            {template.variables.length > 3 && (
              <span className="text-[9px] px-1.5 py-0.5 text-stone-400">+{template.variables.length - 3}</span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(template.id); }}
            className="w-full py-2.5 bg-white border border-[#7C5C3F]/30 text-[#7C5C3F] hover:bg-[#7C5C3F] hover:text-white rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-medium group-hover:bg-[#7C5C3F] group-hover:text-white"
          >
            {t('templates.editTemplate')}
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
