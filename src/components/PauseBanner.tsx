import Link from "@/components/Link";
import { Pause } from "lucide-react";
import { activePause } from "@/lib/cohort";
import { formatGregorian, formatHijri, formatShort, keyToDate } from "@/lib/dates";

/**
 * شريطٌ في رأس كل صفحة والدفعة موقوفة مؤقتاً: يعلم صاحبه لماذا لا يُقبل تسليمه،
 * ومتى يُتوقّع العود، وأن ما تأخّر قبل الإيقاف وحده مفتوح. وللمدير رابط الاستئناف.
 */
export default async function PauseBanner({ audience }: { audience: "participant" | "mentor" | "admin" }) {
  const pause = await activePause();
  if (!pause) return null;
  const since = new Date(pause.since);
  const until = pause.until ? keyToDate(pause.until) : null;
  return (
    <div role="status" className="rounded-xl px-4 py-3 text-sm border-2 border-ink bg-paper-3 mb-4 flex items-start gap-3 no-print">
      <Pause size={18} className="shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="font-medium">البرنامج موقوف مؤقتاً منذ {formatShort(since)}</div>
        {pause.reason && <div className="whitespace-pre-wrap mt-1">{pause.reason}</div>}
        <div className="text-xs mt-1">
          {until ? `العودة المتوقعة السبت ${formatHijri(until)} (${formatGregorian(until)}). ` : "لم يُحدَّد موعد العودة بعد. "}
          {audience === "participant"
            ? "مواعيدك محفوظة، ولا يُحسب عليك تأخيرٌ مدة الإيقاف. يُتاح تسليم ما تأخّر قبل الإيقاف وحده، ويُفتح الباقي عند الاستئناف بمواعيده الجديدة."
            : audience === "mentor"
              ? "لا تُحسب مدة الإيقاف تأخيراً على أحد، وتُزاح المواعيد المتبقية عند الاستئناف."
              : "التذكيرات محبوسة، وعدّاد التأخير واقف، والتسليم مقصورٌ على ما تأخّر قبل الإيقاف."}
        </div>
      </div>
      {audience === "admin" && (
        <Link href="/admin/cohorts" className="btn btn-sm shrink-0">
          الاستئناف
        </Link>
      )}
    </div>
  );
}
