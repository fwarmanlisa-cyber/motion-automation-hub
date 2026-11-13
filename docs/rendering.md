# رندر معمولی ریلز — نسخهٔ ۱.۳

مسیر فعلی: کد موشن آماده از مدل رسمی AI در بیرون از سرور دریافت می‌شود؛ سرور ما آن را در Chromium اجرا و با FFmpeg به MP4 تبدیل می‌کند. اتصال مستقیم به مدل و اتوماسیون محلی هنوز ساخته نمی‌شوند. توسعهٔ کتابخانه‌های حرفه‌ای و افکت‌های پیشرفته هدف آینده است؛ زیرساخت افزونه در این مرحله طراحی نشده است.

## پیش‌نیاز Windows

Node.js نسخهٔ 22 یا بالاتر، FFmpeg با libx264 و یک Chromium محلی لازم است. ابتدا در پوشهٔ نصب‌شده:

```powershell
Set-Location C:\Motion_Automation_Hub_Ready
npm ci
npx playwright install chromium
ffmpeg -version
```

Chromium فقط بار اول دانلود می‌شود. FFmpeg را از نصب معتبر موجود خود در PATH قرار دهید. اگر نصب نیست و winget دارید:

```powershell
winget install --id Gyan.FFmpeg --exact --accept-package-agreements --accept-source-agreements
```

پس از نصب، PowerShell تازه باز کنید تا PATH به‌روز شود. به‌جای PATH می‌توانید مسیرهای نصب موجود را صریح تعیین کنید:

```powershell
$env:FFMPEG_PATH = 'C:\Tools\ffmpeg\bin\ffmpeg.exe'
$env:FFPROBE_PATH = 'C:\Tools\ffmpeg\bin\ffprobe.exe' # فقط برای تست بررسی ویدئو
# اگر از Chrome موجود به‌جای مرورگر Playwright استفاده می‌کنید:
$env:CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
```

این مسیرها نمونه‌اند؛ باید با محل نصب شما مطابق باشند. پروژهٔ media-mcp تغییری نمی‌کند.

## ساخت مستقیم خروجی

بدون راه‌اندازی دستی سرور، یک فرمان کافی است؛ رندر، سرور داخلی موقت خودش را اجرا و متوقف می‌کند:

```powershell
Set-Location C:\Motion_Automation_Hub_Ready
npm run render:code
```

کد `C:\Motion_Automation_Hub_Ready\motion\reel.js` اجرا می‌شود؛ خروجی پیش‌فرض عمودی 1080×1920، با 30 FPS و مدت ۴ ثانیه است. مسیر MP4 جدید در پوشهٔ `outputs` در پایان چاپ می‌شود. خروجی نام یکتا دارد و ویدئوی قبلی بازنویسی نمی‌شود.

برای مسیر سناریوی عمودی شش‌ثانیه‌ای:

```powershell
npm run render:reel
```

ورودی آن `scenarios/reel.json` است. ورودی یا خروجی اختصاصی:

```powershell
npm run render:code -- --input motion/reel.js --output outputs/my-first-reel.mp4
```

نام خروجی اختصاصی باید جدید باشد؛ فایل موجود جایگزین نمی‌شود. پروژهٔ JSON قبلی نیز از `node scripts/render.js --source project --input projects/generated.json` قابل رندر است.

## قرارداد کد دریافتی از مدل

کد باید یک JavaScript ES module معمولی، بدون حصار Markdown و بدون HTML کامل باشد:

```javascript
export const composition = { width: 1080, height: 1920, fps: 30, duration: 4 };
export function createMotion({ stage, gsap }) {
  stage.style.background = '#101827';
  const title = document.createElement('h1');
  title.textContent = 'سلام دنیا';
  Object.assign(title.style, {
    position: 'absolute', top: '800px', width: '100%',
    textAlign: 'center', color: '#ffffff', fontSize: '80px'
  });
  stage.append(title);
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(title, { opacity: 0, y: 80 },
    { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0);
  timeline.to(title, { opacity: 0, duration: 0.5 }, 3.5);
  return timeline;
}
```

`createMotion` همگام است؛ آن را async نکنید. GSAP timeline دارای then است و نباید await شود. تمام انیمیشن‌ها را روی همین تایم‌لاین قرار دهید. مدت تایم‌لاین باید دست‌کم مدت composition باشد. از timer، زمان واقعی، تصادف، CSS animation مستقل و بارگذاری خارجی استفاده نکنید؛ تایم‌لاین با زمان دقیق هر فریم نمونه‌برداری می‌شود.

ابعاد باید زوج باشند، FPS صحیح ۱ تا ۶۰، مدت بیشتر از صفر و حداکثر ۱۲۰ ثانیه و تعداد فریم دقیقاً صحیح باشد. رندر فریم‌های `0` تا `frameCount-1` را در زمان `frame / fps` می‌گیرد؛ فریم اضافی در انتهای ویدئو تولید نمی‌شود. خروجی فعلی بدون صدا و با H.264/yuv420p است.

کد در مرورگر رندر اجرا می‌شود، نه در Node.js. مرورگر رندر فقط به منابع داخلی همان رندر دسترسی دارد؛ سرور داخلی فقط خواندنی است و درخواست بیرونی مسدود می‌شود. این محدودسازی جایگزین sandbox امنیتی برای کد ناشناس یا نامطمئن نیست؛ سرور محلی و برای کد مورداعتماد است. CDN، import کتابخانهٔ خارجی و تصاویر/فونت‌های خارجی فعلاً پشتیبانی نمی‌شوند. فونت از سیستم است؛ تطابق پیکسلی میان دستگاه‌های مختلف تضمین نشده است.

## پیش‌نمایش و کنترل پخش

```powershell
npm start
```

در مرورگر مسیر `http://127.0.0.1:5500/code-preview/` را باز کنید. اگر PORT دیگری تعیین کرده‌اید آن را جایگزین کنید. این صفحه فایل محلی `motion/reel.js` را با همان قرارداد اجرا می‌کند و پخش، مکث، شروع مجدد و seek دارد. برای بازبینی کد گرفته‌شده از مدل، ابتدا آن را در این فایل یا نسخهٔ پشتیبان‌دار آن قرار دهید و صفحه را تازه کنید. این پیش‌نمایش فایل محلی است؛ تزریق HTTP زیر فقط snapshot همان درخواست را رندر می‌کند و فایل محلی را تغییر نمی‌دهد.

## تزریق کد از بیرون با HTTP

سرور را با `npm start` اجرا نگه دارید. API فقط به loopback متصل است. در PowerShell دوم:

```powershell
Set-Location C:\Motion_Automation_Hub_Ready
$base = 'http://127.0.0.1:5500'
$payload = @{
  source = 'code'
  code = Get-Content .\motion\reel.js -Raw -Encoding UTF8
} | ConvertTo-Json -Depth 10
$job = Invoke-RestMethod -Method Post -Uri "$base/api/renders" `
  -ContentType 'application/json; charset=utf-8' `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($payload))
$job
```

پاسخ `202` و شناسهٔ کار برمی‌گردد. در همان پنجره، وضعیت را بررسی کنید:

```powershell
$status = Invoke-RestMethod "$base/api/renders/$($job.id)"
$status
```

تا وقتی `state` برابر `running` است، درخواست وضعیت را تکرار کنید. `phase`، `frame` و `total` پیشرفت را نشان می‌دهند. پس از `completed`، فایل را بگیرید:

```powershell
if ($status.state -ne 'completed') { throw 'Render is not complete; inspect status/error first.' }
Invoke-WebRequest -Uri "$base$($status.videoUrl)" -OutFile ".\outputs\$($job.id)-download.mp4"
```

برای فرستندهٔ بیرونی کافی است `POST /api/renders` با `{ "source": "code", "code": "...ES module..." }` بفرستد. حداکثر بدنهٔ درخواست ۱ مگابایت است. `source: scenario` بدون code نمونهٔ عمودی را رندر می‌کند؛ `source: project` پروژهٔ فعال سرور را رندر می‌کند؛ `source: code` بدون code فایل محلی نمونه را می‌خواند.

هم‌زمان یک رندر پذیرفته می‌شود؛ رندر هم‌زمان پاسخ 409 می‌گیرد. در خطا state برابر failed و error حاوی علت است؛ خروجی ناقص به‌عنوان MP4 موفق منتشر نمی‌شود. وضعیت آخرین ۲۰ کار در حافظه است و پس از راه‌اندازی مجدد از بین می‌رود؛ فایل‌های MP4 در outputs باقی می‌مانند. برای فایل‌های قبلی پس از restart از دیسک استفاده کنید. لغو کار، صف پایدار، صدا و اتصال به مدل در این مرحله وجود ندارند.

## شواهد بررسی

```powershell
npm test
npm run test:browser
npm run test:render
```

تست رندر به Chromium، FFmpeg و ffprobe نیاز دارد. فایل موقت واقعی می‌سازد و H.264، ابعاد، FPS، مدت، تعداد فریم، حرکت واقعی تصویر، برابری پیکسل‌های decoded در دو اجرای یکسان، رد خروجی موجود، پاک‌سازی خطا و چرخهٔ تزریق کد HTTP تا دریافت MP4 را بررسی می‌کند. نمونهٔ کامل نیز با 1080×1920، ۳۰ FPS، ۴ ثانیه و دقیقاً ۱۲۰ فریم آزمایش شده است. تست‌ها فقط در محیط Linux این جلسه اجرا شده‌اند؛ دستورات Windows ارائه شده‌اند ولی روی Windows اجرا نشده‌اند.
