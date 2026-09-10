"use client";

import { useState } from "react";

/** رابط اشتراك التقويم مع زر نسخ — لأن اللصق في تطبيق التقويم أسهل من كتابته */
export default function CalendarSubscribe({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <code className="block text-xs bg-paper-2 rounded-lg p-2 break-all mb-2" dir="ltr">{url}</code>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "نُسخ الرابط" : "نسخ الرابط"}
        </button>
        <a className="btn btn-secondary btn-sm" href={url.replace(/^https?:/, "webcal:")}>إضافة إلى التقويم</a>
        <a className="btn btn-ghost btn-sm" href={url} download="maalem.ics">تنزيل الملف</a>
      </div>
    </div>
  );
}
