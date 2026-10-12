# راهنمای جامع ایجاد نرم‌افزار جدید با بویلرپلیت نورا (Nora)

این سند راهنمای گام‌به‌گام برای توسعه‌دهندگان است تا بتوانند بر پایه بویلرپلیت نورا، **ده‌ها نرم‌افزار مستقل دسکتاپ** (فروشگاهی، پوز، اتوماسیون، پایش سلامت دستگاه، حسابداری، اینترنت اشیاء و ...) بدون نیاز به دست‌زدن به زیرساخت هسته (`src/core/`) ایجاد کنند.

---

## قانون طلایی معماری نورا
> **هرگز کدهای موجود در `src/core/` را برای منطق بیزینسی نرم‌افزار جدید تغییر ندهید.**  
> هسته سیستم وظیفه مدیریت پنجره، تایتل‌بار ویندوز ۱۱، ترای ویندوز، موتور آپدیتر، موتور صف، تم و سرویس‌های پایه سخت‌افزار را بر عهده دارد. تمام منطق، صفحات، منوها و استایل‌های اختصاصی شما در `src/app/` قرار می‌گیرند.

---

## ساختار لایه اختصاصی هر برنامه (`src/app/`)

```text
src/app/
├── config.ts              # شناسنامه و تنظیمات اصلی اپلیکیشن (نام، نسخه، منوها)
├── changelog.json         # تاریخچه تغییرات و ویژگی‌های نسخه‌های این برنامه
├── pages/                 # صفحات اختصاصی برنامه (داشبورد، فرم‌ها، گزارش‌ها)
│   ├── Dashboard.tsx
│   ├── Orders.tsx
│   └── ...
└── components/            # کامپوننت‌های بیزینسی مختص به همین نرم‌افزار
    ├── ProductCard.tsx
    └── ...
```

---

## مراحل ایجاد یک نرم‌افزار جدید (گام‌به‌گام)

### گام ۰: کپی پروژه، راه‌اندازی مخزن گیت و اتصال به هسته نورا
پوشه پروژه نورا (`E:\projects\nora`) را به عنوان پوشه پروژه جدید خود کپی کنید (مثلاً در `E:\projects\nora-pos`). سپس در ترمینال پروژه جدید این دستورات را بزنید تا یک گیت کاملاً مستقل برای اپلیکیشن جدید بسازید و پروژه مادر را به عنوان ریموت لوکال جهت آپدیت‌های آینده تعریف کنید:

```bash
# رفتن به پوشه پروژه جدید
cd E:\projects\nora-pos

# حذف پوشه گیت قبلی (اگر کپی شده بود) و ساخت گیت مستقل لوکال برای این اپ
rmdir /s /q .git
git init -b main

# اتصال پروژه مادر به عنوان ریموت محلی فقط‌خواندنی جهت دریافت آپدیت‌های هسته در آینده
git remote add core E:/projects/nora

# ثبت اولین کامیت پروژه جدید
git add .
git commit -m "feat: initial commit of POS app based on Nora boilerplate"
```

> **توجه مهم:** گیت این پروژه کاملاً مستقل است و تمام تغییرات اختصاصی اپ شما بدون هیچ تداخلی در همین مخزن کامیت می‌شود. هر زمان در آینده هسته نورا آپدیت شد، کافیست طبق راهنمای `docs/UPDATING_CORE.md` فقط فایل‌های هسته را فچ و چِک‌اوت کنید.

---

### گام ۱: تنظیم شناسنامه و منوی برنامه در `src/app/config.ts`
فایل `src/app/config.ts` را باز کرده و اطلاعات برنامه خود را وارد کنید:

```typescript
export const APP_CONFIG: AppConfig = {
  appName: "فروشگاه و صندوق نورا (POS)", // نام نمایشی در تایتل‌بار، ترای و هدر
  appId: "com.nora.pos",                  // شناسه منحصر‌به‌فرد
  version: "1.0.0",                       // نسخه اختصاصی این برنامه
  coreVersion: "1.0.0",                   // نسخه هسته نورا
  defaultLanguage: "fa",                  // زبان پیش‌فرض ("fa" یا "en")
  defaultTheme: "dark",                   // تم پیش‌فرض ("dark" یا "light")
  enableTray: true,                       // فعال‌سازی آیکون ترای ویندوز
  enableUpdater: true,                    // فعال‌سازی موتور آپدیت خودکار
  updaterEndpoint: "https://your-domain.com/updates/pos.json", // آدرس مانیفست آپدیت
  about: {
    developer: "تیم نرم‌افزاری نورا",
    website: "https://your-domain.com",
    copyright: "© 2026 کلیه حقوق محفوظ است.",
    descriptionFa: "سامانه یکپارچه فروش، صندوق و مدیریت چاپگرهای حرارتی تحت ویندوز.",
    descriptionEn: "All-in-one POS and Thermal Receipt management system for Windows.",
  },
  menuItems: [
    // سطح ۱ (آیکون درشت)
    {
      id: "pos-dashboard",
      label: "داشبورد فروش",
      icon: "LayoutDashboard",
      path: "/",
    },
    // سطح ۱ با زیرمنو (سطح ۲ آیکون ریز + سطح ۳ متنی)
    {
      id: "sales",
      label: "فروش و فاکتور",
      icon: "ShoppingCart",
      children: [
        {
          id: "new-invoice",
          label: "صدور فاکتور جدید",
          icon: "FilePlus",
          path: "/sales/new",
        },
        {
          id: "thermal-receipts",
          label: "چاپ فیش حرارتی",
          icon: "Printer",
          children: [
            { id: "kitchen-printer", label: "پرینتر آشپزخانه", path: "/printers/kitchen" },
            { id: "cashier-printer", label: "پرینتر صندوق", path: "/printers/cashier" },
          ],
        },
      ],
    },
    // لینک صفحه تنظیمات پیش‌ساخته هسته
    {
      id: "settings",
      label: "تنظیمات",
      icon: "Settings",
      path: "/settings",
    },
  ],
};
```

---

### گام ۲: ایجاد صفحات در `src/app/pages/`
برای هر مسیر در منو، یک کامپوننت صفحه استاندارد بسازید:

```tsx
// src/app/pages/NewInvoice.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { HardwareService } from "@/core/services/hardware";

export const NewInvoice = () => {
  const handlePrint = async () => {
    // ارسال مستقیم بایت‌های ESC/POS به پرینتر فیش
    await HardwareService.printEscPos("POS-58", [0x1b, 0x40, 0x4e, 0x4f, 0x52, 0x41, 0x0a]);
  };

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>ثبت سفارش و صدور فاکتور</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handlePrint}>چاپ فیش حرارتی</Button>
        </CardContent>
      </Card>
    </div>
  );
};
```

سپس صفحه را در `src/App.tsx` در تابع `renderContent()` به روت مربوط متصل کنید:
```tsx
case "/sales/new":
  return <NewInvoice />;
```

---

### گام ۳: استفاده از ابزارهای سخت‌افزاری ویندوز (Hardware HAL)
برای ارتباط با پورت‌های COM، اسکنر بارکد، پرینتر یا ترازو، فقط از `HardwareService` استفاده کنید:

```typescript
import { HardwareService } from "@/core/services/hardware";

// ۱. لیست تمام پورت‌های متصل
const ports = await HardwareService.listSerialPorts();

// ۲. ارسال دستور به آردوینو یا اسکنر و دریافت جواب
const response = await HardwareService.sendCommand("COM3", "READ_WEIGHT", 9600);
console.log(response.response);

// ۳. لیست پرینترهای متصل
const printers = await HardwareService.listPrinters();
```

---

### گام ۴: زمان‌بندی کارهای پس‌زمینه (Task Scheduler)
اگر نرم‌افزار شما کارهای دوره‌ای دارد (مثلاً استعلام وضعیت هر ۱ ساعت یا بکاپ‌گیری شبانه):
```typescript
import { useTaskStore } from "@/core/store/taskStore";

const { addTask } = useTaskStore.getState();
addTask("بررسی وضعیت اتصال ترازو", "hourly", "hardware");
```
این کارها به طور خودکار در تب‌های صفحه **صف و زمان‌بند کارها (`/tasks`)** ثبت و مدیریت می‌شوند.

---

### گام ۵: انتشار نسخه جدید و چنج‌لاگ
هنگام انتشار هر نسخه جدید:
1. در `src/app/config.ts` مقدار `version` را مثلاً به `1.1.0` تغییر دهید.
2. در `src/app/changelog.json` رکورد جدید تغییرات را اضافه کنید:
```json
[
  {
    "version": "1.1.0",
    "date": "2026-10-01",
    "title": "پشتیبانی از کارت‌خوان جدید و گزارشات اکسل",
    "highlights": [
      "افزودن پروتکل ارتباطی کارتخوان به لایه سریال",
      "ارتقای سرعت چاپ فیش‌های حرارتی"
    ]
  }
]
```
وقتی مشتری نسخه جدید را اجرا کند، نرم‌افزار به صورت خودکار تغییر نسخه را تشخیص داده و مودال جذاب **ویژگی‌های جدید (What's New)** را نمایش می‌دهد.

---

### گام ۶: اجرای باینری‌ها و انجین‌های جانبی (Sidecars - Python / C++ / Go / Node)
اگر نرم‌افزار شما به یک موتور کمکی جانبی (مثلاً اسکریپت پایتون، باینری هوش مصنوعی یا ورکر C++) نیاز دارد، **هرگز به کدهای Rust دست نزنید!** نورا سرویس استاندارد `SidecarService` را برای این منظور آماده کرده است.

#### استراتژی‌های استقرار باینری (Deployment Strategies):
1. **تک‌فایل مطلق و ادغام بایت‌ها درون باینری (Embedded Single-File Binary via `include_bytes!`):**  
   کافی است فایل باینری موتور کمکی خود (مثلاً `engine.exe`، اسکریپت کامپایل‌شده پایتون یا ورکر C++) را درون پوشه `src/app/assets/bin/` قرار دهید (مثلاً `src/app/assets/bin/engine.exe`).
   اسکریپت بیلد نورا (`scripts/sync-app-config.mjs` و `src-tauri/build.rs`) به صورت خودکار در زمان کامپایل، بایت‌های این باینری را از طریق ماکروی بومی `include_bytes!` مستقیماً درون کدهای ماشین تک‌فایل `.exe` نهایی ادغام و جاسازی می‌کند. هنگام اولین اجرای برنامه توسط کاربر، هسته نورا آن را به صورت خودکار، امن و نامرئی در `%LOCALAPPDATA%/<appId>/bin/` اکسترکت کرده و اجرا می‌نماید. بدین ترتیب نسخه پرتابل شما **۱۰۰٪ تک‌فایل مستقل و بدون نیاز به هیچ فایل یا پوشه جانبی در کنار فایل `.exe`** خواهد بود.
2. **استقرار در کنار فایل اجرایی (Portable Exe Directory):**  
   می‌توانید باینری را در کنار فایل اصلی یا درون پوشه `engines/` یا `bin/` کنار فایل `.exe` بگذارید.
3. **پوشه استاندارد AppData کاربر (%APPDATA% / %LOCALAPPDATA%):**  
   هسته نورا پوشه‌های استاندارد را به صورت خودکار سرچ می‌کند (`resolve_sidecar_path`). همچنین می‌توانید مسیر دقیق آن را با متد `SidecarService.getSidecarDirectories()` دریافت کنید.

```typescript
import { SidecarService } from "@/core/services/sidecar";

// ۱. لیست باینری‌های ادغام‌شده در بایت‌های فایل پرتابل (اختیاری)
const embeddedList = await SidecarService.listEmbeddedSidecars();
// خروجی مثلا: ["engine.exe"]

// ۲. دریافت مسیرهای استاندارد (اختیاری)
const dirs = await SidecarService.getSidecarDirectories();
// dirs.exe_dir, dirs.app_local_data_dir, dirs.suggested_bin_dir

// ۳. اجرای باینری جانبی در پس‌زمینه (مخفی، بدون پنجره سیاه کنسول و همراه با چک پورت)
// نکته: نیازی به ارسال مسیر کامل نیست؛ نورا اولویت اول را به باینری توکار (Embedded) می‌دهد و در صورت نیاز خودکار آن را استخراج و اجرا می‌کند:
const status = await SidecarService.startSidecar({
  name: "python_engine",
  command: "engine.exe", // نام فایلی که در src/app/assets/bin/ گذاشته بودید
  args: ["--port", "5000"],
  checkPort: 5000,   // اطمینان از آزاد بودن پورت قبل از استارت
});

console.log(status.message);

// ۴. استعلام وضعیت زنده بودن پروسه
const state = await SidecarService.getStatus("python_engine");

// ۵. متوقف کردن دستی پروسه
await SidecarService.stopSidecar("python_engine");
```
> **نکته ایمنی:** تمام پراسس‌های استارت‌شده با این سرویس، هنگام بسته شدن برنامه نورا به طور خودکار توسط هسته بسته و Kill می‌شوند (`Lifecycle Cleanup`).

---

### گام ۷: مدیریت آیکون‌های اختصاصی برنامه فرزند
اگر نرم‌افزار شما آیکون اختصاصی دارد:
کافیست آیکون‌های خود (`icon.ico`, `32x32.png`, `128x128.png` و ...) را در مسیر `src/app/assets/icons/` قرار دهید. اسکریپت بیلد نورا به طور خودکار قبل از کامپایل، آیکون‌ها را جایگزین و تزریق می‌کند بدون اینکه با آپدیت‌های آینده هسته پاک شوند.

---

## به‌روزرسانی هسته بویلرپلیت در آینده
اگر هسته نورا را در مخزن مادر ارتقا دادید، جهت اعمال سریع آپدیت‌ها در پروژه خود بدون آسیب دیدن کدهای `src/app/`، به راهنمای جامع **`docs/UPDATING_CORE.md`** مراجعه کنید یا دستور زیر را اجرا کنید:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync-core.ps1 -SourcePath "E:\projects\nora"
```

---

## دستورات کار با پروژه
- **اجرای پیش‌نمایش توسعه:** `npm run dev`
- **تست بیلد تایپ‌اسکریپت و کدهای استاتیک:** `npm run build`
- **اجرای نسخه دسکتاپ Tauri:** `npm run tauri dev`
- **تولید خروجی نصبی ویندوز (.msi / .exe):** `npm run tauri build`
