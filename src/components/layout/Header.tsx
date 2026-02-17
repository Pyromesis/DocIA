import { motion } from "framer-motion";
import { Search, ShieldCheck } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { LANGUAGE_NAMES } from "../../i18n/translations";
import type { Language } from "../../i18n/translations";
import type { ActivePage } from "@/types/navigation";

interface HeaderProps {
  activePage: ActivePage;
}

export function Header({ activePage }: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();

  // Map route IDs to translation keys
  const pageKey = activePage === 'data-vault' ? 'dataVault' : activePage;
  const title = t(`header.${pageKey}.title`);
  const subtitle = t(`header.${pageKey}.subtitle`);
  // If translation returned the key itself, fallback
  const displayTitle = title.startsWith('header.') ? activePage : title;
  const displaySubtitle = subtitle.startsWith('header.') ? '' : subtitle;

  const languages: Language[] = ['en', 'es', 'zh'];

  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-stone-200/50 bg-white/80 px-8 backdrop-blur-sm z-20">
      <div className="flex flex-col justify-center">
        <motion.h1
          key={activePage + language}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[17px] font-semibold text-stone-900 tracking-tight"
        >
          {displayTitle}
        </motion.h1>
        <p className="text-[12px] text-stone-400 mt-0.5 hidden sm:block">{displaySubtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Language Switcher */}
        <div className="flex items-center bg-stone-100/50 rounded-xl p-1 border border-stone-200/50 mr-2">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${language === lang
                ? 'bg-white shadow-sm text-docia-coffee'
                : 'text-stone-400 hover:text-stone-600'
                }`}
              title={LANGUAGE_NAMES[lang]}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Privacy Indicator */}
        <div className="hidden items-center gap-1.5 rounded-xl border border-sage-200/60 bg-sage-50/50 px-3 py-1.5 md:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-sage-500" />
          <span className="text-[10px] font-semibold text-sage-600 uppercase tracking-wide">{t('header.local')}</span>
        </div>

        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder={t('header.search')}
            className="h-9 w-48 lg:w-56 rounded-xl border border-stone-200/80 bg-cream-50 pl-9 pr-4 text-[13px] text-stone-700 outline-none transition-all placeholder:text-stone-400 focus:border-docia-coffee/30 focus:bg-white focus:ring-2 focus:ring-docia-coffee/10"
          />
        </div>

        {/* Separator */}
        <div className="mx-1 h-6 w-px bg-stone-200/60" />

        {/* User Avatar */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-docia-coffee-light to-docia-coffee text-[11px] font-bold text-white transition-transform hover:scale-105 shadow-sm"
          aria-label="User menu"
        >
          DA
        </button>
      </div>
    </header>
  );
}
