/* عامل الخدمة لمنصة معالم التربية: تحديث كامل عند كل إصدار + تخزين مؤقت + إشعارات الدفع */
const VERSION = "__SW_VERSION__";
const CACHE = `maalem-${VERSION}`;
/**
 * مخزون الأصول الثابتة لا يحمل رقم الإصدار: أسماء ملفاتها تحمل بصمة محتواها،
 * فلا تقدُم ولا تتعارض. وحذفها مع كل إصدار كان ينزع من تحت صفحةٍ مفتوحة رقعاتِها
 * التي قد تطلبها بعد النشر — فتتعطّل بـ «فشل تحميل الرقعة» وتظهر شاشة خطأ.
 */
const STATIC_CACHE = "maalem-static";
const OFFLINE_URL = "/offline.html";
/**
 * مدخل التطبيق المثبَّت: صفحة ساكنة تُخزَّن على الجهاز فتُرسم مع أول لحظة، ثم
 * تنتقل إلى لوحة المستخدم. بها تُستبدل الشاشة السوداء التي كانت تمتد حتى تصل
 * صفحة التطبيق من الخادم.
 */
const BOOT_URL = "/boot"; // يُقدَّم من public/boot.html وتُسقط الخدمةُ الامتداد
const PRECACHE = [OFFLINE_URL, BOOT_URL, "/icons/icon-192.png"];
/** أقصى ما يُحتفظ به من الأصول الثابتة، فلا يتضخّم المخزون نشرةً بعد نشرة */
const STATIC_LIMIT = 200;

/** صفحة عدم اتصال احتياطية إن لم تكن المخزّنة موجودة، فلا يُرَدّ على التنقّل بلا شيء */
const OFFLINE_FALLBACK = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>لا يوجد اتصال</title><style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:2rem;background:#fff;color:#111}@media(prefers-color-scheme:dark){body{background:#0f0f0f;color:#f2f2f2}}</style></head><body><main><h1>لا يوجد اتصال بالإنترنت</h1><p>أعد المحاولة عند عودة الاتصال.</p></main></body></html>`;

/**
 * التخزين المسبق: يُجلب كل ملف ويُخزَّن رداً نظيفاً غير محوَّل. على الاستضافة
 * يُحوَّل «offline.html» إلى «offline» بلا امتداد، والمتصفح يرفض أن يُجاب طلبُ
 * تنقّل بردٍّ محوَّل من المخزون فتظهر صفحة خطأ المتصفح بدل صفحة عدم الاتصال.
 */
async function precache() {
  const c = await caches.open(CACHE);
  await Promise.all(
    PRECACHE.map(async (u) => {
      try {
        const res = await fetch(u, { redirect: "follow", cache: "no-cache" });
        if (!res.ok) return;
        const body = await res.arrayBuffer();
        await c.put(u, new Response(body, { status: 200, headers: { "content-type": res.headers.get("content-type") || "text/html; charset=utf-8" } }));
      } catch {
        // يُعاد المسعى عند التفعيل أو عند طلب الصفحة
      }
    }),
  );
}

// لا نستدعي skipWaiting هنا: ينتظر الإصدار الجديد حتى يوافق المستخدم من داخل التطبيق
self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // تُحذف مخزونات الإصدارات السابقة، ويبقى مخزون الأصول الثابتة لأن الصفحات
      // المفتوحة على الإصدار السابق قد تطلب منه رقعةً بعد النشر
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE && k !== STATIC_CACHE).map((k) => caches.delete(k)));
      // ما مُسح من المخزون المسبق — بتحديث أو إصلاح عميق — يُعاد جلبه هنا
      await precache();
      await pruneStatic();
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
      await self.clients.claim();
    })(),
  );
});

/** يُبقي أحدث الأصول الثابتة فقط: مفاتيح المخزون بترتيب إدخالها، فتُحذف الأقدم */
async function pruneStatic() {
  try {
    const c = await caches.open(STATIC_CACHE);
    const keys = await c.keys();
    if (keys.length <= STATIC_LIMIT) return;
    await Promise.all(keys.slice(0, keys.length - STATIC_LIMIT).map((k) => c.delete(k)));
  } catch {
    // المخزون غير متاح
  }
}

// رسائل من الصفحة: تطبيق التحديث فوراً، أو إعادة التخزين المسبق بعد إصلاح عميق مسح المخزون
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();
  if (data.type === "PRECACHE") event.waitUntil(precache());
});

/** مفتاح تخزين الصفحة بلا معاملات التعافي والمصدر، فلا يُخزَّن كل طلب إعادة تحميل نسخةً مستقلة */
function pageKey(url) {
  const u = new URL(url);
  u.searchParams.delete("_r");
  u.searchParams.delete("source");
  return u.toString();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // الملفات الثابتة (أسماؤها تحمل بصمة المحتوى): من التخزين المؤقت أولاً،
  // وإن تعذّرت الشبكة أو اختفى الملف بعد نشر جديد فمن المخزون، فلا تنكسر صفحة مفتوحة
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            return res;
          }
          // اختفى الملف من الخادم بعد نشر جديد: نسخة المخزون أولى من ردٍّ فاشل يكسر الصفحة
          const stale = await caches.match(req, { ignoreSearch: true });
          return stale || res;
        } catch (e) {
          const fallback = await caches.match(req, { ignoreSearch: true });
          if (fallback) return fallback;
          throw e;
        }
      })(),
    );
    return;
  }

  // مدخل التطبيق: من المخزون أولاً بلا انتظار شبكة — وهو ساكن لا يقدُم
  if (url.pathname === BOOT_URL || url.pathname === "/boot.html") {
    event.respondWith(
      (async () => {
        const hit = await caches.match(BOOT_URL);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(BOOT_URL, copy));
        }
        return res;
      })(),
    );
    return;
  }

  // الصفحات: الشبكة أولاً حتى لا يُعرض محتوى قديم، ثم المخزون، ثم صفحة عدم الاتصال.
  // واجهات البرمجة — التصدير والملفات — لا تُخزَّن: بياناتٌ خاصة تُجلب من الشبكة وحدها.
  if (req.mode === "navigate") {
    if (url.pathname.startsWith("/api/")) return;
    event.respondWith(
      (async () => {
        const key = pageKey(req.url);
        try {
          const preload = await event.preloadResponse;
          const res = preload || (await fetch(req));
          const cc = (res.headers.get("cache-control") || "").toLowerCase();
          if (res.ok && !/no-store|private/.test(cc)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(key, copy));
          }
          return res;
        } catch {
          return (
            (await caches.match(key)) ||
            (await caches.match(OFFLINE_URL)) ||
            new Response(OFFLINE_FALLBACK, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } })
          );
        }
      })(),
    );
  }
});

/** رقم الإشعارات غير المقروءة على أيقونة التطبيق في الشاشة الرئيسة */
async function setBadge(count) {
  try {
    if (typeof count !== "number" || !self.navigator || !("setAppBadge" in self.navigator)) return;
    if (count > 0) await self.navigator.setAppBadge(count);
    else await self.navigator.clearAppBadge();
  } catch {
    // الشارة غير مدعومة على هذا النظام
  }
}

self.addEventListener("push", (event) => {
  // الوجهة الافتراضية صفحة الإشعارات المشتركة التي تحوّل كل دور إلى صفحته
  let data = { title: "معالم التربية", body: "", url: "/notifications" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    (async () => {
      // الرقم يصل مع الإشعار محسوباً في الخادم، فيظهر على الأيقونة والتطبيق مغلق
      await setBadge(data.count);
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        dir: "rtl",
        lang: "ar",
        data: { url: data.url },
        tag: data.tag || undefined,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
      for (const client of list) {
        if ("focus" in client) {
          // نافذة لا يتحكم بها العامل قد ترفض الانتقال، فتُفتح نافذة بدلها
          try {
            const moved = "navigate" in client ? await client.navigate(url) : null;
            return (moved || client).focus();
          } catch {
            break;
          }
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
