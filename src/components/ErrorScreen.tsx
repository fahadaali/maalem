"use client";

import { useEffect, useState } from "react";
import { RotateCcw, RefreshCw, LifeBuoy, ChevronDown } from "lucide-react";
import { errorDetail, isStaleAssetError, recover, repairNow } from "@/lib/client-errors";

/**
 * شاشة تعطّل بديلة عن رسالة Next الإنجليزية.
 * إن كان العطل من أصول إصدار سابق بوشر التعافي تلقائياً — إعادة تحميل، ثم مسح
 * المخزون إن تكرّر — وإلا عُرض للمستخدم ما يفعله بدل أن تُترك الشاشة سوداء.
 */
export default function ErrorScreen({ error, reset, bare }: { error: Error & { digest?: string }; reset?: () => void; bare?: boolean }) {
  const [stage, setStage] = useState<"" | "reload" | "repair">("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isStaleAssetError(error)) return;
    const r = recover();
    if (r !== "give-up") setStage(r);
  }, [error]);

  const frame = bare ? "min-h-dvh" : "py-10";

  if (stage) {
    return (
      <div className={`${frame} flex flex-col items-center justify-center gap-3 p-6 text-center`}>
        <RefreshCw size={22} className="animate-spin" aria-hidden />
        <p className="text-sm text-muted">{stage === "repair" ? "يُنظَّف المخزون ويُعاد التحميل…" : "يُحدَّث التطبيق إلى آخر إصدار…"}</p>
      </div>
    );
  }

  const deepRepair = async () => {
    setBusy(true);
    await repairNow();
  };

  return (
    <div className={`${frame} flex items-center justify-center`}>
      <div className="card max-w-md w-full text-center">
        <h1 className="text-xl mb-2">تعذّر عرض هذه الصفحة</h1>
        <p className="text-sm text-ink-2 mb-1">حدث عطل غير متوقع أثناء العرض. بياناتك سليمة ولم يضِع منها شيء.</p>
        <p className="text-sm text-muted mb-5">جرّب إعادة المحاولة، فإن تكرّر فأصلح التطبيق إصلاحاً عميقاً.</p>
        <div className="flex gap-2 justify-center flex-wrap">
          {reset && (
            <button className="btn" onClick={reset} disabled={busy}>
              <RotateCcw size={16} /> إعادة المحاولة
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => window.location.reload()} disabled={busy}>
            <RefreshCw size={16} /> إعادة تحميل التطبيق
          </button>
          <button className="btn btn-secondary" onClick={deepRepair} disabled={busy}>
            <LifeBuoy size={16} /> {busy ? "جارٍ الإصلاح…" : "إصلاح عميق"}
          </button>
        </div>
        <p className="text-xs text-muted mt-3">الإصلاح العميق يمسح الملفات المخزَّنة على الجهاز ويعيد جلبها. لا يمسّ بياناتك ولا يُخرجك من حسابك.</p>
        <button type="button" className="text-xs text-muted mt-4 inline-flex items-center gap-1" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <ChevronDown size={13} className={open ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden /> التفاصيل التقنية
        </button>
        {open && (
          <p className="text-[11px] text-muted mt-2 break-words text-start bg-paper-2 rounded-lg p-2" dir="ltr">
            {errorDetail(error)}
          </p>
        )}
      </div>
    </div>
  );
}
