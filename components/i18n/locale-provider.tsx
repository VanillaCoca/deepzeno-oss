"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  defaultLocale,
  dictionaries,
  isLocale,
  type Locale,
} from "@/lib/i18n/dictionaries";

const STORAGE_KEY = "zeno-locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Start from the default so the server and the first client render match;
  // read the stored choice after mount (avoids a hydration mismatch).
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) {
      setLocaleState(stored);
    }
  }, []);

  const value = useMemo<LocaleContextValue>(() => {
    return {
      locale,
      setLocale: (next: Locale) => {
        setLocaleState(next);
        localStorage.setItem(STORAGE_KEY, next);
      },
      t: (key: string) =>
        dictionaries[locale][key] ?? dictionaries[defaultLocale][key] ?? key,
    };
  }, [locale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
