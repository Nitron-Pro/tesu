import { create } from "zustand";
import { APP_CONFIG } from "@/app/config";
import { translations, Language, TranslationKey } from "@/core/i18n/translations";

export type ThemeMode = "dark" | "midnight" | "light";
export type FaFont = "vazirmatn" | "estedad";
export type EnFont = "inter" | "dm-sans";

interface SettingsState {
  theme: ThemeMode;
  language: Language;
  faFont: FaFont;
  enFont: EnFont;
  autoUpdate: boolean;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (lang: Language) => void;
  setFaFont: (font: FaFont) => void;
  setEnFont: (font: EnFont) => void;
  setAutoUpdate: (val: boolean) => void;
  toggleTheme: () => void;
  t: (key: TranslationKey) => string;
}

// Load initial values from localStorage or default
const savedTheme = (localStorage.getItem("nora_theme") as ThemeMode) || APP_CONFIG.defaultTheme;
const savedLang = (localStorage.getItem("nora_lang") as Language) || APP_CONFIG.defaultLanguage;
const savedFaFont = (localStorage.getItem("nora_fa_font") as FaFont) || "vazirmatn";
const savedEnFont = (localStorage.getItem("nora_en_font") as EnFont) || "inter";
const savedAutoUpdate = localStorage.getItem("nora_auto_update") !== "false";

function applyFonts(faFont: FaFont, enFont: EnFont) {
  document.documentElement.dataset.faFont = faFont;
  document.documentElement.dataset.enFont = enFont;
}

// Apply initial DOM classes
if (typeof document !== "undefined") {
  document.documentElement.classList.remove("light", "dark", "midnight");
  document.documentElement.classList.add(savedTheme);
  document.documentElement.dir = savedLang === "fa" ? "rtl" : "ltr";
  document.documentElement.lang = savedLang;
  applyFonts(savedFaFont, savedEnFont);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: savedTheme,
  language: savedLang,
  faFont: savedFaFont,
  enFont: savedEnFont,
  autoUpdate: savedAutoUpdate,

  setTheme: (theme) => {
    localStorage.setItem("nora_theme", theme);
    document.documentElement.classList.remove("light", "dark", "midnight");
    document.documentElement.classList.add(theme);
    set({ theme });
  },

  setLanguage: (language) => {
    localStorage.setItem("nora_lang", language);
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
    document.documentElement.lang = language;
    set({ language });
  },

  setFaFont: (faFont) => {
    localStorage.setItem("nora_fa_font", faFont);
    applyFonts(faFont, get().enFont);
    set({ faFont });
  },

  setEnFont: (enFont) => {
    localStorage.setItem("nora_en_font", enFont);
    applyFonts(get().faFont, enFont);
    set({ enFont });
  },

  setAutoUpdate: (autoUpdate) => {
    localStorage.setItem("nora_auto_update", String(autoUpdate));
    set({ autoUpdate });
  },

  toggleTheme: () =>
    set((state) => {
      const nextTheme: ThemeMode =
        state.theme === "dark" ? "light" : state.theme === "light" ? "midnight" : "dark";
      localStorage.setItem("nora_theme", nextTheme);
      document.documentElement.classList.remove("light", "dark", "midnight");
      document.documentElement.classList.add(nextTheme);
      return { theme: nextTheme };
    }),

  t: (key: TranslationKey) => {
    const lang = get().language;
    return translations[lang]?.[key] || translations.en[key] || key;
  },
}));
