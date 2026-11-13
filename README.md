# Motion Automation Hub

استودیوی محلی موشن‌گرافیک با HTML، CSS، JavaScript و GSAP. نسخهٔ فعلی موتور پایهٔ داده‌محور است؛ AI و رندر ویدئو هنوز پیاده‌سازی نشده‌اند.

## راه‌اندازی در Windows PowerShell

نیازمندی: Node.js نسخهٔ 22 یا بالاتر همراه npm.

```powershell
Set-Location C:\Motion_Automation_Hub
npm ci
npm start
```

سرور محلی روی پورت 5500 اجرا می‌شود و مسیر `/` یا `/apps/studio/` استودیو را نمایش می‌دهد. برای توقف `Ctrl+C` بزنید. در محیط ابری پوشهٔ پروژه `/workspace/motion-automation-hub` است.

## ویرایش پروژه

فایل `C:\Motion_Automation_Hub\projects\demo.json` (در محیط ابری `/workspace/motion-automation-hub/projects/demo.json`) را ویرایش کنید و دکمهٔ «بارگذاری مجدد JSON» را بزنید. عنوان «سلام از فایل JSON» از این فایل خوانده می‌شود. پخش پس از بارگذاری به‌صورت خودکار آغاز نمی‌شود.

- `elements`: متن و دایره، موقعیت، ابعاد، رنگ و اندازهٔ قلم.
- `animations`: شناسهٔ عنصر مقصد، زمان شروع و مدت بر حسب ثانیه، easing، مقادیر `from` و `to`.
- ویژگی‌های متحرک مجاز: `x`، `y`، `opacity`، `scale` و `rotation`.
- موقعیت پایهٔ عناصر از گوشهٔ بالا و چپ بر حسب پیکسل طراحی محاسبه می‌شود. `x` و `y` انیمیشن نسبت به موقعیت پایه‌اند. پیش‌نمایش متناسب با فضای نمایش کوچک می‌شود.
- ابعاد، FPS و مدت در JSON ذخیره می‌شوند؛ FPS فعلاً فقط فراداده است و نرخ نمایش مرورگر را تعیین نمی‌کند.

سرور JSON را با `packages/motion-engine/project.schema.json` اعتبارسنجی می‌کند. شناسه‌های تکراری، مقصد ناموجود، زمان‌بندی خارج از مدت پروژه و ویژگی‌های ناشناخته رد می‌شوند. هیچ رشته‌ای از JSON به‌صورت کد JavaScript اجرا نمی‌شود؛ متن با `textContent` درج می‌شود.

برای سادگی و تکرارپذیری، انیمیشن‌های یک ویژگی روی یک عنصر را هم‌پوشان نکنید. چند صحنه، ویرایشگر گرافیکی تایم‌لاین و ذخیره از UI در این مرحله وجود ندارند.

## تست

```powershell
Set-Location C:\Motion_Automation_Hub
npm test
# فقط بار اول برای آزمون مرورگر، با اینترنت:
npx playwright install chromium
# در پنجرهٔ دیگر npm start را باز نگه دارید:
npm run test:browser
```

می‌توانید مسیر Chromium نصب‌شده را به‌جای دانلود تعیین کنید:

```powershell
$env:CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:browser
```

آزمون مرورگر JSON، ساخت صحنه، پخش، مکث، seek، restart، بارگذاری متن جدید، بازیابی خطا و چیدمان موبایل را بررسی می‌کند. تصویر آزمایش در `test-results/studio.png` ذخیره می‌شود.

## تفکیک اجزا

- `apps/studio/`: رابط و کنترل‌های پیش‌نمایش.
- `packages/motion-engine/`: Scene Builder، قرارداد JSON و اعتبارسنجی.
- `server/index.js`: سرور Node.js و ارائهٔ فایل‌های محلی مجاز.
- `projects/demo.json`: پروژهٔ نمونهٔ ۱۰ ثانیه‌ای 1920×1080.
- `tests/`: تست‌های Node.js و آزمون واقعی مرورگر.

پس از نصب وابستگی‌ها، اجرای استودیو به اینترنت، CDN یا API ابری وابسته نیست. فونت فعلاً از فونت‌های سیستم استفاده می‌کند؛ برای خروجی یکسان روی دستگاه‌های مختلف، در مرحلهٔ رندر به فونت محلی ثابت نیاز داریم. پروژهٔ media-mcp تغییری نمی‌کند.
