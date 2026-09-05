/* عامل الخدمة لمنصة معالم التربية: تحديث كامل عند كل إصدار + تخزين مؤقت + إشعارات الدفع */
const VERSION = "__SW_VERSION__";
const CACHE = `maalem-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png"];

// لا نستدعي skipWaiting هنا: ينتظر الإصدار الجديد حتى يوافق المستخدم من داخل التطبيق
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // حذف كل مخزون الإصدارات السابقة: تحديث كامل لا جزئي
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
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

  // الملفات الثابتة (أسماؤها تحمل بصمة المحتوى): من التخزين المؤقت أولاً
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
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

self.addEventListener("push", (event) => {
  let data = { title: "معالم التربية", body: "", url: "/app/notifications" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      dir: "rtl",
      lang: "ar",
      data: { url: data.url },
      tag: data.tag || undefined,
    }),
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
