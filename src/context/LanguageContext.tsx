import React, { createContext, useContext, useState, ReactNode } from 'react';
import { translations, Language } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => any;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageSt] = useState<Language>(() => {
    const saved = localStorage.getItem('docia-language');
    return (saved as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageSt(lang);
    localStorage.setItem('docia-language', lang);
  };

  // Helper to safely access nested keys like 'dashboard.title'
  const t = (path: string): any => {
    const keys = path.split('.');
    let current: any = translations[language];

    for (const key of keys) {
      if (current?.[key] === undefined) {
        // Fallback to English
        let fallback: any = translations['en'];
        for (const k of keys) {
          if (fallback?.[k] === undefined) return path;
          fallback = fallback[k];
        }
        return fallback;
      }
      current = current[key];
    }

    return current;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
