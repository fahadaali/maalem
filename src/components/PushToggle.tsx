"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";

type State = "loading" | "unsupported" | "denied" | "off" | "on" | "ios-not-installed" | "no-keys";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushToggle({ compact, publicKey }: { compact?: boolean; publicKey: string | null }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const key = publicKey;

  useEffect(() => {
    (async () => {
      if (!key) return setState("no-keys");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
        return setState(ios && !standalone ? "ios-not-installed" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, [key]);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key!) });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error();
      setState("on");
    } catch {
      alert("تعذّر تفعيل الإشعارات على هذا الجهاز");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    await fetch("/api/push/test", { method: "POST" });
    setTestSent(true);
    setTimeout(() => setTestSent(false), 4000);
  }

  const msg: Record<State, string> = {
    loading: "جارٍ التحقق…",
    unsupported: "هذا المتصفح لا يدعم إشعارات الدفع. جرّب متصفحاً حديثاً أو ثبّت التطبيق.",
    denied: "الإشعارات محظورة من إعدادات المتصفح أو الجهاز. فعّلها من إعدادات الموقع ثم أعد المحاولة.",
    off: "فعّل الإشعارات لتصلك تذكيرات الورد، وموعد التقرير، والحلقة، والتغذية الراجعة.",
    on: "الإشعارات مفعّلة على هذا الجهاز.",
    "ios-not-installed": "على آيفون: ثبّت التطبيق على الشاشة الرئيسية أولاً (زر المشاركة ← إضافة إلى الشاشة الرئيسية) ثم فعّل الإشعارات من داخله.",
    "no-keys": "لم تُضبط مفاتيح الإشعارات على الخادم بعد. الإشعارات داخل المنصة تعمل، وإشعارات الدفع تحتاج ضبط المفاتيح.",
  };

  if (compact && state !== "off") return null;

  return (
    <div className={compact ? "card card-muted flex items-center justify-between gap-3 text-sm" : ""}>
      <div className="flex items-start gap-2 text-sm">
        {state === "on" ? <BellRing size={18} className="shrink-0 mt-0.5" /> : state === "denied" ? <BellOff size={18} className="shrink-0 mt-0.5" /> : <Bell size={18} className="shrink-0 mt-0.5" />}
        <span>{msg[state]}</span>
      </div>
      <div className={compact ? "shrink-0" : "mt-3 flex gap-2 flex-wrap"}>
        {state === "off" && <button className="btn btn-sm" onClick={enable} disabled={busy}>تفعيل الإشعارات</button>}
        {state === "on" && !compact && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={test}>{testSent ? "أُرسل إشعار تجريبي" : "إشعار تجريبي"}</button>
            <button className="btn btn-ghost btn-sm" onClick={disable} disabled={busy}>إيقاف على هذا الجهاز</button>
          </>
        )}
      </div>
    </div>
  );
}
