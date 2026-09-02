import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { core } from "./core";
import { datasets } from "./pages/datasets";
import { quality } from "./pages/quality";
import { compare } from "./pages/compare";
import { reconcile } from "./pages/reconcile";
import { master } from "./pages/master";
import { explore } from "./pages/explore";
import { riders } from "./pages/riders";

export type Lang = "en" | "id";

const STORAGE_KEY = "verity.lang";

// Each namespace's `en`/`id` objects must have identical keys -- callers
// index into whichever the current language resolved to.
const dictionaries = {
  en: {
    ...core.en,
    datasets: datasets.en,
    quality: quality.en,
    compare: compare.en,
    reconcile: reconcile.en,
    master: master.en,
    explore: explore.en,
    riders: riders.en,
  },
  id: {
    ...core.id,
    datasets: datasets.id,
    quality: quality.id,
    compare: compare.id,
    reconcile: reconcile.id,
    master: master.id,
    explore: explore.id,
    riders: riders.id,
  },
} satisfies Record<Lang, Record<string, Record<string, string>>>;

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const [ns, ...rest] = key.split(".");
  const field = rest.join(".");
  const value = (dictionaries[lang] as Record<string, Record<string, string>>)[ns ?? ""]?.[field];
  if (value !== undefined) return interpolate(value, vars);
  const fallback = (dictionaries.en as Record<string, Record<string, string>>)[ns ?? ""]?.[field];
  return interpolate(fallback ?? key, vars);
}

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LangContext = createContext<LangContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Server (and first client paint) always render "en" so hydration matches;
  // a saved preference is applied right after mount, same pattern as
  // useActiveWorkspace's localStorage-backed state.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "id") setLangState(saved);
    } catch {
      // localStorage unavailable (private mode, etc.) -- stay on default.
    }
  }, []);

  // Keep the <html lang> attribute in sync for screen readers, on mount and
  // on every switch -- not just inside setLang, since the effect above sets
  // state directly (bypassing setLang) when restoring a saved preference.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore -- preference just won't persist this session
    }
  };

  const value: LangContextValue = {
    lang,
    setLang,
    t: (key, vars) => translate(lang, key, vars),
  };

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within a LanguageProvider");
  return ctx;
}
