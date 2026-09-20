import type { ReactNode } from "react";
import Link from "@/components/Link";
import { Video } from "lucide-react";
import { formatGregorian, keyToDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { LiveWeek } from "@/lib/weeks";
import type { RowState, WeekState } from "@/lib/week-state";

type Row = {
  key: keyof WeekState;
  day: string;
  meta: string;
  track: string;
  body: string;
  /** رابط الحلقة أو مكان اللقاء، في صفّه وحده */
  extra?: ReactNode;
};

/**
 * بطاقة الأسبوع: الأيام والمدد والمسارات وما يُسلَّم في نهايته، كما في بطاقات
 * البرنامج المطبوعة. تُبنى من صفّ الأسبوع في القاعدة لا من صورة، فتتبع تعديلات
 * مدير المشروع وتختلف باختلاف الدفعة، وتُقرأ في الوضع الليلي وفي الطباعة.
 */
export default function WeekCard({
  week, total, cohortName, state, current, cardUrl, className,
}: {
  week: LiveWeek;
  total: number;
  cohortName?: string;
  state?: WeekState;
  current?: boolean;
  cardUrl?: string;
  className?: string;
}) {
  const n = week.number;
  const rows = rowsFor(week);
  // «—» في جدول البرنامج تعني «لا شيء هنا» لا نصّاً يُقرأ
  const hasTask = !!week.task && week.task !== "—";

  return (
    <section className={cn("card p-0 overflow-hidden", current && "border-ink", className)}>
      <header className="bg-ink text-paper px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {week.competency && week.competency !== "—" ? (
            <span className="inline-flex items-center rounded-full border border-paper/40 px-2.5 py-0.5 text-xs">{week.competency}</span>
          ) : (
            <span />
          )}
          <span className="text-xs opacity-70">{kickerFor(week)}</span>
        </div>
        <h2 className="display text-2xl mt-2 text-paper">{titleFor(week)}</h2>
        <p className="text-xs opacity-70 mt-1">
          {week.hijri} · {formatGregorian(keyToDate(week.gregorian))}
        </p>
        {current && <span className="inline-flex items-center rounded-full bg-paper text-ink px-2.5 py-0.5 text-xs mt-3">الأسبوع الحالي</span>}
      </header>

      {week.note && (
        <p className="bg-paper-3 px-5 py-2 text-sm border-b border-line">{week.note}</p>
      )}

      {rows.length > 0 ? (
        <div className="divide-y divide-line">
          {rows.map((r) => (
            <div key={r.key} className="px-5 py-4 grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-x-4 gap-y-1">
              <div>
                <div className="font-medium">{r.day}</div>
                <div className="text-xs text-muted">{r.meta}</div>
              </div>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-xs text-muted">{r.track}</span>
                  {state?.[r.key] && <StateBadge state={state[r.key]!} />}
                </div>
                <p className="mt-0.5">{r.body}</p>
                {r.extra}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // الأسبوع الاحتياطي: لا أيام له، وإنما وصفٌ لما يُستدرك فيه
        <p className="px-5 py-5 text-lg">{week.session}</p>
      )}

      {/*
        تسليمان لا تسليم: المهمةُ ناتجٌ يُرفع ويُقيَّم من ستّ عشرة، والتقريرُ
        تقريرٌ ذاتيٌّ عن الأسبوع كلِّه بلا درجة. وكانا سطراً واحداً تعلوه شارةُ
        التقرير فوق نصّ المهمة، فيُقرأ أحدُهما على الآخر.
      */}
      {(hasTask || state?.report) && (
        <footer className="bg-paper-3 px-5 py-4 border-t border-line space-y-3">
          {hasTask && (
            <div>
              <span className="text-xs text-muted">{deliverableLabel(n)}</span>
              <div className="font-medium mt-0.5">{week.task}</div>
            </div>
          )}
          {/*
            الشارةُ والرابطُ للمشارك وحده: `state` لا يُمرَّر في صفحة البرنامج
            العامة، فتبقى هناك بطاقةً تُقرأ لا باباً إلى التطبيق.
          */}
          {state?.report && (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <Link href={`/app/reports/${n}`} className="text-sm underline hover:text-ink">
                التقرير الأسبوعي — الخميس قبل العاشرة مساءً
              </Link>
              <StateBadge state={state.report} />
            </div>
          )}
        </footer>
      )}

      <div className="px-5 py-2 text-xs text-muted flex flex-wrap justify-between gap-x-3 border-t border-line">
        <span>{footerLabel(n, total)}</span>
        {cohortName && <span>{cohortName}</span>}
      </div>

      {cardUrl && (
        // مطويّة افتراضياً: الصورة تُجلب عبر /api/files بلا تخزين مؤقت، فلا تُحمَّل إلا عند طلبها
        <details className="border-t border-line no-print">
          <summary className="px-5 py-3 text-sm cursor-pointer">بطاقة الأسبوع (صورة للمشاركة والطباعة)</summary>
          <div className="px-5 pb-4">
            {/* محسِّن next/image لا يعمل على العامل بلا إعداد، والمرفق يُقدَّم بصلاحيات من /api/files فلا يُخزَّن في شبكة التوزيع أصلاً */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cardUrl} alt={`بطاقة ${titleFor(week)}`} loading="lazy" className="w-full rounded-xl border border-line" />
            <a href={cardUrl} download className="btn btn-sm btn-secondary mt-3">تحميل الصورة</a>
          </div>
        </details>
      )}
    </section>
  );
}

function StateBadge({ state }: { state: RowState }) {
  return <span className={cn("badge", state.done ? "badge-ink" : "badge-soft")}>{state.done ? `✓ ${state.label}` : state.label}</span>;
}

/** «الأسبوع 03» — والأسابيع الخاصة بأسمائها كما في البطاقات المطبوعة */
function titleFor(w: LiveWeek): string {
  if (w.number === 0) return "الافتتاح";
  if (w.number === 14) return "أسبوع احتياطي";
  return `الأسبوع ${String(w.number).padStart(2, "0")}`;
}

/** سطر الترويسة العلوي: يتبدّل في أسابيع الخبراء والأسبوع الختامي */
function kickerFor(w: LiveWeek): string {
  if (w.session.includes("اللقاء الشهري")) return "لقاء شهري مع خبير";
  if (w.number === 13) return "الأسبوع الختامي";
  return "معالم التربية";
}

/**
 * عنوانُ سطر المهمة. ومَوعدُ الخميس انتقل إلى سطر التقرير حيث هو قاعدةٌ ثابتة
 * من الميثاق؛ وأما المهمة فلكلٍّ منها موعدُها الذي يضبطه المدير، فلا يُوعَد
 * هنا بموعدٍ قد لا يكون موعدَها.
 */
function deliverableLabel(n: number): string {
  if (n === 13) return "التسليم النهائي";
  if (n === 14) return "ملاحظة";
  return "المهمة الأسبوعية";
}

function footerLabel(n: number, total: number): string {
  if (n === 0) return "اللقاء الافتتاحي";
  if (n === 13) return `الأسبوع ${n} من ${total} — الختامي`;
  if (n === 14) return "أسبوع احتياطي";
  return `الأسبوع ${n} من ${total}`;
}

/**
 * صفوف الأسبوع: ثلاثة في الأسابيع التي لا معايشة فيها، وأربعة فيما عداها،
 * وللأسبوع الختامي صفوفه، وللاحتياطي لا صفوف.
 */
function rowsFor(w: LiveWeek): Row[] {
  if (w.number === 14) return [];

  const place = w.meetingPlace ? <span className="badge badge-soft mt-2">المكان: {w.meetingPlace}</span> : null;
  const link = w.remoteUrl ? (
    <a href={w.remoteUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary mt-2">
      <Video size={14} /> دخول حلقة النقاش
    </a>
  ) : null;

  if (w.number === 13) {
    return [
      { key: "session", day: "السبت", meta: "حضوري", track: "المناقشة والحفل الختامي", body: w.session, extra: place },
      { key: "circle", day: "الثلاثاء", meta: "ساعة · عن بُعد", track: "جلسة التقويم", body: w.circle, extra: link },
    ];
  }

  const rows: Row[] = [
    { key: "session", day: "السبت", meta: "ساعتان · حضوري", track: kickerFor(w) === "لقاء شهري مع خبير" ? "اللقاء الشهري مع خبير" : "اللقاء الحضوري", body: w.session, extra: place },
  ];
  if (w.reading && w.reading !== "—") {
    rows.push({ key: "reading", day: "الأحد – الخميس", meta: "40 دقيقة يومياً", track: "الورد القرائي", body: w.reading });
  }
  if (w.circle && w.circle !== "—") {
    rows.push({ key: "circle", day: "الثلاثاء", meta: "ساعة · عن بُعد", track: "حلقة النقاش", body: w.circle, extra: link });
  }
  if (w.field) {
    rows.push({ key: "field", day: "يومٌ تختاره", meta: "ساعة · ميداني", track: "المعايشة الميدانية", body: w.field });
  }
  return rows;
}
