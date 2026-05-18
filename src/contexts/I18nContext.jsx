import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { messages, resolveLocale } from '../i18n/messages';

const I18nContext = createContext(null);

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => (acc && part in acc ? acc[part] : undefined), obj);
}

export function I18nProvider({ children }) {
  const locale = resolveLocale(import.meta.env.VITE_APP_LOCALE || 'en');
  const fallbackLocale = 'en';

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => {
    const t = (key, fallback = key) => {
      const primary = getNestedValue(messages[locale], key);
      if (typeof primary === 'string') return primary;
      const secondary = getNestedValue(messages[fallbackLocale], key);
      if (typeof secondary === 'string') return secondary;
      return fallback;
    };

    return { locale, t };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export default I18nContext;
