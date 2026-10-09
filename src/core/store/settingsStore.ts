import { create } from "zustand";
import { APP_CONFIG } from "@/app/config";
import { translations, Language, TranslationKey } from "@/core/i18n/translations";

interface SettingsState {
  theme: "dark" | "light";
  language: Language;
  autoUpdate: boolean;
  setTheme: (theme: "dark" | "light") => void;
  setLanguage: (lang: Language) => void;
  setAutoUpdate: (val: boolean) => void;
  toggleTheme: () => void;
  t: (key: TranslationKey) => string;
}

// Load initial values from localStorage or default
const savedTheme = (localStorage.getItem("nora_theme") as "dark" | "light") || APP_CONFIG.defaultTheme;
const savedLang = (localStorage.getItem("nora_lang") as Language) || APP_CONFIG.defaultLanguage;
const savedAutoUpdate = localStorage.getItem("nora_auto_update") !== "false";

// Apply initial DOM classes
if (typeof document !== "undefined") {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(savedTheme);
  document.documentElement.dir = savedLang === "fa" ? "rtl" : "ltr";
  document.documentElement.lang = savedLang;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: savedTheme,
  language: savedLang,
  autoUpdate: savedAutoUpdate,

  setTheme: (theme) => {
    localStorage.setItem("nora_theme", theme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    set({ theme });
  },

  setLanguage: (language) => {
    localStorage.setItem("nora_lang", language);
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
    document.documentElement.lang = language;
    set({ language });
  },

  setAutoUpdate: (autoUpdate) => {
    localStorage.setItem("nora_auto_update", String(autoUpdate));
    set({ autoUpdate });
  },

  toggleTheme: () =>
    set((state) => {
      const nextTheme = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("nora_theme", nextTheme);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(nextTheme);
      return { theme: nextTheme };
    }),

  t: (key: TranslationKey) => {
    const lang = get().language;
    return translations[lang]?.[key] || translations.en[key] || key;
  },
}));
