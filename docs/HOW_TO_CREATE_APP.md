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

> **قانون مهم برای ایجنت‌ها:**  
> ۱. حتماً `updaterEndpoint` را به آدرس مانیفست اختصاصی سرور خودتان (مانند `https://your-domain.com/updates/releases.json`) تغییر دهید و از آدرس‌های لوکال تست استفاده نکنید.  
> ۲. ابزار تست و شبیه‌سازی نسخه جدید در صفحه تنظیمات صرفاً در حالت توسعه (`DEV`) برای برنامه‌نویس فعال است و در خروجی نهایی کاربر (`production`) وجود ندارد؛ بنابراین نیازی به دستکاری کدهای UI نخواهید داشت.  
> ۳. سیاست پرتابل مطلق نورا: داده‌ها و فایل‌ها را همواره در مسیر کنار فایل اجرایی ذخیره کنید و از ذخیره‌سازی داده‌های پراکنده در درایو C اجتناب نمایید.  
> ۴. **پالت تم هسته در `src/index.css` است** (کلاس‌های `.dark` = Dark Navy، `.midnight` = مشکی مطلق، `:root` = روشن). این فایل جزو هسته است و با آپدیت هسته باید checkout شود؛ استایل اختصاصی اپ را فقط در `src/app/` بگذارید و `src/index.css` را بازنویسی نکنید.

```typescript
export const APP_CONFIG: AppConfig = {
  appName: "فروشگاه و صندوق نورا (POS)", // نام نمایشی در تایتل‌بار، ترای و هدر
  appId: "com.nora.pos",                  // شناسه منحصر‌به‌فرد
  version: "1.0.0",                       // نسخه اختصاصی این برنامه
  coreVersion: "1.4.0",                   // نسخه هسته نورا
  defaultLanguage: "fa",                  // زبان پیش‌فرض ("fa" یا "en")
  defaultTheme: "dark",                   // تم پیش‌فرض ("dark" | "midnight" | "light")
  enableTray: true,                       // فعال‌سازی آیکون ترای ویندوز
  enableUpdater: true,                    // فعال‌سازی موتور آپدیت خودکار
  updaterEndpoint: "https://your-domain.com/updates/releases.json", // آدرس مانیفست آپدیت اختصاصی اپلیکیشن شما
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
2. در `src/app/changelog.json` رکورد جدید را **بالای آرایه** اضافه کنید (newest-first).
3. در مخزن مادر نورا، همزمان `README.md` و اسناد `docs/` اثرپذیر را هم به‌روز کنید؛ اپ‌های دیگر از همین مستندات هسته استفاده می‌کنند. کامیت بدون چنج‌لاگ و README در مادر ممنوع است.
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

#### استراتژی‌های استقرار باینری و ایزولاسیون کامل پرتابل (Portable-First):
1. **تک‌فایل مطلق و بدون ردپا در ویندوز (Embedded Single-File via `include_bytes!`):**  
   فایل باینری موتور کمکی خود (مثلاً `engine.exe`، اسکریپت کامپایل‌شده پایتون یا ورکر C++) را درون پوشه `src/app/assets/bin/` قرار دهید (مثلاً `src/app/assets/bin/engine.exe`).
   اسکریپت بیلد نورا (`scripts/sync-app-config.mjs` و `src-tauri/build.rs`) به صورت خودکار در زمان کامپایل، بایت‌های این باینری را از طریق ماکروی بومی `include_bytes!` مستقیماً درون کدهای ماشین تک‌فایل `.exe` نهایی ادغام و جاسازی می‌کند.
   **نکته معماری پرتابل نورا v1.4.0:** هنگام اجرای برنامه، هسته نورا با اولویت قطعی ابتدا فایل را در پوشه `bin/` **کنار خود فایل اجرایی اصلی برنامه (`current_exe().parent().join("bin")`)** استخراج می‌کند و هیچ فایلی به درایو ویندوز یا C ارسال نمی‌شود.
2. **ارسال متغیر محیطی `PORTABLE_APP_DIR` و تنظیم Working Directory:**  
   هنگام اجرای هر سایدکار توسط `start_sidecar`، هسته نورا متغیر محیطی `PORTABLE_APP_DIR` را با آدرس دقیق دایرکتوری اصلی برنامه پر کرده و Working Directory را به پوشه اصلی نرم‌افزار متصل می‌کند تا انجین پایتون یا C++ داده‌ها، دیتابیس و لاگ‌های خود را منحصراً در کنار فایل برنامه ذخیره کند و هرگز وابسته به درایو ویندوز یا Temp نشود.
3. **استقرار مستقیم در کنار فایل اجرایی (Portable Exe Directory):**  
   می‌توانید باینری را از قبل در کنار فایل اصلی یا درون پوشه `bin/` کنار فایل `.exe` بگذارید؛ نورا مستقیماً آن را شناسایی می‌کند.

```typescript
import { SidecarService } from "@/core/services/sidecar";

// ۱. لیست باینری‌های ادغام‌شده در بایت‌های فایل پرتابل (اختیاری)
const embeddedList = await SidecarService.listEmbeddedSidecars();
// خروجی مثلا: ["engine.exe"]

// ۲. دریافت مسیرهای استاندارد پرتابل و دایرکتوری برنامه
const dirs = await SidecarService.getSidecarDirectories();
// dirs.exe_dir, dirs.portable_bin_dir, dirs.portable_data_dir

// ۳. اجرای باینری جانبی در پس‌زمینه (مخفی، بدون کنسول، با Working Directory کنار exe و تزریق PORTABLE_APP_DIR)
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

### گام ۸: استفاده از سیستم Toast، تایید عملیات (Confirm) و زنگوله نوتیفیکیشن
هسته نورا دارای سیستم اعلان درون‌برنامه‌ای غنی و کامپکت است:
```typescript
import { useNotificationStore } from "@/core/store/notificationStore";

const { toast, confirm } = useNotificationStore();

// ۱. پیام اطلاع‌رسانی سریع (Auto Dismiss):
toast({
  type: "success", // "info" | "success" | "warning" | "error"
  title: "فاکتور صادر شد",
  message: "سفارش با موفقیت در سیستم ثبت گردید.",
  duration: 4000,
});

// ۲. تایید عملیات حساس (Confirmation Action Dialog):
confirm({
  title: "حذف آیتم فاکتور؟",
  message: "آیا مطمئن هستید که این سطر حذف شود؟",
  confirmLabel: "بله، حذف کن",
  confirmVariant: "destructive",
  onConfirm: async () => {
    // اجرای اکشن بعد از تایید کاربر
    await deleteItem();
  },
});

// ۳. تمام ۱۰ نوتیفیکیشن اخیر به همراه تاریخچه در آیکون زنگوله هدر نمایش داده می‌شوند.
```

---

### گام ۹: پایش زنده و ایزولاسیون پروسس‌های سایدکار و کران‌جاب‌ها
کلیه موتورهای کمکی (پایتون، C++، Go، اسکریپت‌ها) به صورت پیش‌فرض در فضای نام اختصاصی برنامه شما (`appId:serviceName`) اجرا شده و در تب **`Tasks & Processes > Process & Sidecar Monitor`** مانیتور می‌شوند. هر نرم‌افزار فرزند تنها سایدکارهای خودش را کنترل و متوقف می‌کند.

---

### گام ۱۰: ابزارهای اتوماسیون بیلد و ساخت خروجی (`tools/`)
پوشه `tools/` در ریشه پروژه مخصوص قرارگیری اسکریپت‌های اتوماسیون محلی است و در `.gitignore` ثبت شده است.
- **قانون ایجنت‌ها:** ایجنت نباید فرآیند سنگین بیلد کامل پروداکشن (`npm run tauri build`) را بدون دستور کاربر شروع کند. **فرمت اجباری ویندوز `tools/build-app.bat` است**؛ فایل `.ps1` به‌تنهایی قبول نیست. اسکریپت باید به ریشه پروژه `cd` کند و پنجره را تا پایان باز نگه دارد.
```bat
tools\build-app.bat
tools\build-app.bat frontend
tools\build-app.bat debug
```

---

## به‌روزرسانی هسته بویلرپلیت در آینده
اگر هسته نورا را در مخزن مادر ارتقا دادید، جهت اعمال سریع آپدیت‌ها در پروژه خود بدون آسیب دیدن کدهای `src/app/`، به راهنمای جامع **`docs/UPDATING_CORE.md`** مراجعه کنید. دستور رسمی checkout باید `src/index.css` را هم بیاورد (پالت تم هسته)؛ در غیر این صورت تم Navy/Midnight فرزند کهنه می‌ماند. معادل اسکریپتی:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync-core.ps1 -SourcePath "E:\projects\nora"
```

---

## دستورات کار با پروژه
- **اجرای پیش‌نمایش توسعه:** `npm run dev`
- **تست بیلد تایپ‌اسکریپت و کدهای استاتیک:** `npm run build`
- **اجرای نسخه دسکتاپ Tauri:** `npm run tauri dev`
- **تولید خروجی نصبی ویندوز (.msi / .exe):** `npm run tauri build`
