# استانداردهای کدنویسی و قراردادهای توسعه (Conventions)

این سند تعیین‌کننده الگوها و قوانین کدنویسی در فرانت‌اند و بک‌اند پروژه Nora است.

---

## ۱. قراردادهای لایه‌بندی (Core vs App)

- **فایل `src/app/config.ts` تنها نقطه ورودی تنظیمات برنامه فرزند است.**
  نمونه ساختار:
  ```typescript
  export interface MenuItem {
    label: string;
    path: string;
    icon: string;
  }

  export interface AppConfig {
    appName: string;
    version: string;
    enableTray: boolean;
    menuItems: MenuItem[];
  }

  export const APP_CONFIG: AppConfig = {
    appName: "Base Boilerplate",
    version: "1.0.0",
    enableTray: true,
    menuItems: [
      { label: "داشبورد", path: "/", icon: "LayoutDashboard" },
      { label: "تست سخت‌افزار", path: "/hardware", icon: "Cpu" },
      { label: "تنظیمات", path: "/settings", icon: "Settings" },
    ],
  };
  ```

- هرگز کدهای بیزینسی یک نرم‌افزار خاص نباید وارد `src/core/` شوند.
- کامپوننت‌های هسته باید از طریق Props یا Context داده‌ها را دریافت کنند تا کاملاً قابل بازاستفاده باشند.

---

## ۲. استانداردهای Rust (Tauri Backend)

- تمام توابع قابل فراخوانی از فرانت‌اند باید به عنوان IPC Command در `src-tauri/src/commands/` تعریف شوند.
- ساختار خروجی توابع Rust به فرانت‌اند باید همواره از نوع `Result<T, String>` باشد تا خطاهای سیستم‌عامل به صورت امن و خوانا در جاوااسکریپت Catch شوند:
  ```rust
  #[tauri::command]
  pub async fn list_ports() -> Result<Vec<String>, String> {
      // safe hardware querying
  }
  ```
- فایل‌های قابلیت‌ها (Capabilities) در پوشه `src-tauri/capabilities/` باید طبق ساختار جدید Tauri 2.0 برای تمامی کامندها و پلاگین‌ها رجیستر شوند.

---

## ۳. استانداردهای TypeScript و فرانت‌اند

- برای هر دستور Rust، باید یک تابع معادل با نام یکسان و تایپ قوی در `src/core/services/` پیاده‌سازی شود:
  ```typescript
  import { invoke } from "@tauri-apps/api/core";

  export const HardwareService = {
    async listPorts(): Promise<string[]> {
      return await invoke<string[]>("list_ports");
    },
  };
  ```
- استایل‌دهی صرفاً با Tailwind CSS کلاس‌محور و استفاده از متغیرهای CSS شبیه به استانداردهای Shadcn UI انجام می‌شود تا سوییچ بین دارک‌مود و لایت‌مود بدون پرش صورت پذیرد.
- پشتیبانی از فونت وزیرمتن و فونت‌های فارسی استاندارد به صورت محلی (بدون نیاز به اینترنت یا CDN).
