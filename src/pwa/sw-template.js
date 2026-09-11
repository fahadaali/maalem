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
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png"];

// لا نستدعي skipWaiting هنا: ينتظر الإصدار الجديد حتى يوافق المستخدم من داخل التطبيق
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // تُحذف مخزونات الإصدارات السابقة، ويبقى مخزون الأصول الثابتة لأن الصفحات
      // المفتوحة على الإصدار السابق قد تطلب منه رقعةً بعد النشر
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE && k !== STATIC_CACHE).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
      await self.clients.claim();
    })(),
  );
});

// رسائل من الصفحة: تطبيق التحديث فوراً، أو الاستعلام عن الإصدار
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();
  if (data.type === "GET_VERSION") event.ports[0]?.postMessage(VERSION);
});

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

  // الصفحات: الشبكة أولاً حتى لا يُعرض محتوى قديم، ثم المخزون، ثم صفحة عدم الاتصال
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          const res = preload || (await fetch(req));
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        } catch {
          return (await caches.match(req)) || (await caches.match(OFFLINE_URL));
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
  let data = { title: "معالم التربية", body: "", url: "/app/notifications" };
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
  const url = (event.notification.data && event.notification.data.url) || "/app/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
