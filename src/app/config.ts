export interface MenuItemLevel3 {
  id: string;
  label: string;
  path: string;
}

export interface MenuItemLevel2 {
  id: string;
  label: string;
  path?: string;
  icon?: string;
  children?: MenuItemLevel3[];
}

export interface MenuItemLevel1 {
  id: string;
  label: string;
  path?: string;
  icon: string; // Lucide icon name (large icon in primary sidebar)
  children?: MenuItemLevel2[];
}

export interface AppAboutInfo {
  developer?: string;
  website?: string;
  copyright?: string;
  descriptionEn?: string;
  descriptionFa?: string;
}

export interface AppConfig {
  appName: string;
  appId: string;
  version: string;
  coreVersion: string;
  defaultLanguage: "en" | "fa";
  defaultTheme: "dark" | "light";
  enableTray: boolean;
  enableUpdater: boolean;
  updaterEndpoint: string;
  about?: AppAboutInfo;
  menuItems: MenuItemLevel1[];
}

export const APP_CONFIG: AppConfig = {
  appName: "Tesu Trader",
  appId: "com.tesu.trader",
  version: "1.1.0",
  coreVersion: "1.1.0",
  defaultLanguage: "fa",
  defaultTheme: "dark",
  enableTray: true,
  enableUpdater: true,
  updaterEndpoint: "https://app.nitron.pro/tesu/releas/releases.json",
  about: {
    developer: "Tesu Trading Systems",
    website: "https://tesu.local",
    copyright: "© 2026 Tesu Trader. All rights reserved.",
    descriptionEn: "High-performance automated MT5 execution platform with Pullback Stop-Entry algorithms and Nora desktop architecture.",
    descriptionFa: "پلتفرم معاملاتی هوشمند و پرسرعت متاتریدر ۵ مبتنی بر استراتژی پولبک استاپ-انتری و معماری نورا.",
  },
  menuItems: [
    {
      id: "dashboard",
      label: "داشبورد معاملات",
      icon: "LayoutDashboard",
      path: "/",
    },
    {
      id: "accounts",
      label: "مدیریت حساب‌ها و MT5",
      icon: "Wallet",
      path: "/accounts",
    },
    {
      id: "bot-presets",
      label: "الگوها و ربات‌ها",
      icon: "Bot",
      path: "/presets",
    },
    {
      id: "telegram",
      label: "ربات تلگرام",
      icon: "Send",
      path: "/telegram",
    },
    {
      id: "reports",
      label: "گزارش عملکرد ترید",
      icon: "LineChart",
      path: "/reports",
    },
    {
      id: "settings",
      label: "تنظیمات نرم‌افزار",
      icon: "Settings",
      path: "/settings",
    },
  ],
};
