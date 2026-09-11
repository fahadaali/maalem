"use client";

import { useEffect, useState } from "react";

type Row = { k: string; v: string };

/**
 * تقرير ما يقوله الجهاز فعلاً عن نفسه، لتشخيص شاشة الإقلاع على أجهزة آبل.
 * لا يُرسل شيئاً إلى الخادم ولا يقرأ بيانات المستخدم — قراءةُ خصائص متصفح فقط.
 */
export default function DeviceReport() {
  const [rows, setRows] = useState<Row[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [probe, setProbe] = useState("…");

  useEffect(() => {
    const mm = (q: string) => (window.matchMedia ? window.matchMedia(q).matches : false);
    const s = window.screen;
    const dpr = window.devicePixelRatio;
    const w = s.width, h = s.height;
    const nav = navigator as Navigator & { standalone?: boolean };
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-startup-image"]'));
    const hits = links.filter((l) => mm(l.media)).map((l) => `${l.href.split("/").pop()}  ←  ${l.media}`);
    setMatched(hits);
    setRows([
      { k: "مقاس الشاشة (نقاط)", v: `${w} × ${h}` },
      { k: "كثافة البكسل", v: String(dpr) },
      { k: "مقاس الصورة المطلوب (بكسل)", v: `${Math.round(w * dpr)} × ${Math.round(h * dpr)}` },
      { k: "الاتجاه", v: mm("(orientation: portrait)") ? "رأسي" : "أفقي" },
      { k: "تفضيل اللون", v: mm("(prefers-color-scheme: dark)") ? "داكن" : "فاتح" },
      { k: "وضع العرض قياسي (standalone)", v: mm("(display-mode: standalone)") ? "نعم" : "لا" },
      { k: "علم iOS القديم (navigator.standalone)", v: nav.standalone === true ? "نعم" : nav.standalone === false ? "لا" : "غير موجود" },
      { k: "عدد وسوم شاشة الإقلاع في الصفحة", v: String(links.length) },
      { k: "المطابق منها", v: String(hits.length) },
      { k: "ملف الإعدادات مربوط", v: document.querySelector('link[rel="manifest"]') ? "نعم" : "لا" },
      { k: "معرّف المتصفح", v: navigator.userAgent },
    ]);
    const name = `${w}x${h}-${Math.round(dpr)}x.png`;
    fetch(`/splash/${name}`, { method: "GET", cache: "no-store" })
      .then((r) => setProbe(`${name} → ${r.status} ${r.ok ? "موجودة" : "غير موجودة"}`))
      .catch(() => setProbe(`${name} → تعذّر الجلب`));
  }, []);

  return (
    <div className="space-y-4">
      <div className="card">
        <table className="table text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.k}>
                <td className="font-medium align-top">{r.k}</td>
                <td dir="ltr" className="text-start break-all">{r.v}</td>
              </tr>
            ))}
            <tr>
              <td className="font-medium align-top">صورة مقاس هذا الجهاز</td>
              <td dir="ltr" className="text-start break-all">{probe}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="text-sm font-medium mb-2">الوسوم المطابقة لهذا الجهاز</div>
        {matched.length === 0 ? (
          <p className="text-sm text-muted">لا وسم يطابق — وهذا وحده يفسّر شاشة الإقلاع السوداء.</p>
        ) : (
          <ul className="space-y-1">
            {matched.map((m) => (
              <li key={m} dir="ltr" className="text-[11px] text-muted break-all">{m}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
