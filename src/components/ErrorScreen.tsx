"use client";

import { useEffect, useState } from "react";
import { RotateCcw, RefreshCw } from "lucide-react";
import { isStaleAssetError, reloadOnce } from "@/lib/client-errors";

/**
 * شاشة تعطّل بديلة عن رسالة Next الإنجليزية.
 * إن كان العطل من أصول إصدار سابق أُعيد التحميل تلقائياً مرة واحدة،
 * وإلا عُرض للمستخدم ما يفعله بدل أن تُترك الشاشة سوداء.
 */
export default function ErrorScreen({ error, reset, bare }: { error: Error & { digest?: string }; reset?: () => void; bare?: boolean }) {
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (isStaleAssetError(error)) setRecovering(reloadOnce());
  }, [error]);

  const frame = bare ? "min-h-dvh" : "py-10";

  if (recovering) {
    return (
      <div className={`${frame} flex flex-col items-center justify-center gap-3 p-6 text-center`}>
        <RefreshCw size={22} className="animate-spin" aria-hidden />
        <p className="text-sm text-muted">يُحدَّث التطبيق إلى آخر إصدار…</p>
      </div>
    );
  }

  return (
    <div className={`${frame} flex items-center justify-center`}>
      <div className="card max-w-md w-full text-center">
        <h1 className="text-xl mb-2">تعذّر عرض هذه الصفحة</h1>
        <p className="text-sm text-ink-2 mb-1">
          حدث عطل غير متوقع أثناء العرض. بياناتك سليمة ولم يضِع منها شيء.
        </p>
        <p className="text-sm text-muted mb-5">جرّب إعادة المحاولة، فإن تكرّر فأعد تحميل التطبيق.</p>
        <div className="flex gap-2 justify-center flex-wrap">
          {reset && (
            <button className="btn" onClick={reset}>
              <RotateCcw size={16} /> إعادة المحاولة
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> إعادة تحميل التطبيق
          </button>
        </div>
        {error.digest && <p className="text-[11px] text-muted mt-4" dir="ltr">{error.digest}</p>}
      </div>
    </div>
  );
}
