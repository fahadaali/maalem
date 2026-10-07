import Link from "@/components/Link";
import { requireParticipantView } from "@/lib/auth";
import { PageHeader, Card, Empty, Stat } from "@/components/ui";
import FormMessage from "@/components/FormMessage";
import ObligationList from "@/components/ObligationList";
import { GROUP_LABELS, obligationsForView, type ObligationGroup } from "@/lib/obligations";
import { cn } from "@/lib/utils";

export const metadata = { title: "مهامي" };

const GROUPS = Object.keys(GROUP_LABELS) as ObligationGroup[];

/**
 * «مهامي»: كل ما يُطلب من المشارك في صفحة واحدة، مرتّباً بما يحتاج عمله الآن.
 *
 * كانت هذه الصفحة قائمة «المهام المقيَّمة» وحدها، والتقريرُ في بابٍ، والوردُ في
 * آخر، والخطة والمشروع والقيادة كلٌّ في بابه — وما تأخّر منها لا يظهر في مكانٍ
 * واحد ولا يُعدّ. فصارت تجمعها كلَّها بحالها وعدّادها، والصفحات الأخرى باقيةٌ
 * أبواباً للتسليم نفسه.
 */
export default async function MyTasksPage({ searchParams }: { searchParams: Promise<{ type?: string; ok?: string; err?: string }> }) {
  const user = await requireParticipantView();
  const sp = await searchParams;
  const now = new Date();
  const preview = user.role !== "PARTICIPANT";

  const res = await obligationsForView(user, now);

  const type = GROUPS.includes(sp.type as ObligationGroup) ? (sp.type as ObligationGroup) : undefined;
  const all = res?.items ?? [];
  const items = type ? all.filter((o) => o.group === type) : all;
  const of = (state: (typeof items)[number]["state"]) => items.filter((o) => o.state === state);
  const returned = of("returned");
  const overdue = of("overdue");
  const due = of("due");
  const upcoming = of("upcoming");
  const done = of("done");

  return (
    <>
      <PageHeader
        title="مهامي"
        subtitle="كل ما يُطلب منك في البرنامج في مكان واحد: المهام والتقارير والورد والاختبارات والمعايشة والخطة والمشروع — ما تأخّر منها وما أُرجع إليك أولاً."
      />
      <FormMessage ok={sp.ok} err={sp.err} />
      {preview && <div className="card card-muted text-sm mb-4">في المعاينة تُحسب البنود لحسابك أنت كأنك مشاركٌ لم يسلّم شيئاً.</div>}
      {res?.otherCohort && <div className="card card-muted text-sm mb-4">حسابك في دفعةٍ غير الدفعة النشطة، فلا تُحسب عليك مواعيد جدولها. راجع مدير المشروع.</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="أُرجع إليك للتعديل" value={res?.counts.returned ?? 0} />
        <Stat label="متأخر" value={res?.counts.overdue ?? 0} />
        <Stat label="مطلوب هذا الأسبوع" value={res?.counts.due ?? 0} />
        <Stat label="منجز" value={res?.counts.done ?? 0} />
      </div>

      <nav className="flex gap-1 overflow-x-auto pb-3 mb-3 -mx-4 px-4" aria-label="تصفية حسب النوع">
        <Link href="/app/tasks" prefetch={false} className={cn("badge shrink-0", !type && "badge-ink")} aria-current={!type ? "page" : undefined}>
          الكل ({all.filter((o) => o.state !== "done").length})
        </Link>
        {GROUPS.map((g) => {
          const n = all.filter((o) => o.group === g && o.state !== "done").length;
          return (
            <Link key={g} href={`/app/tasks?type=${g}`} prefetch={false} className={cn("badge shrink-0", type === g && "badge-ink")} aria-current={type === g ? "page" : undefined}>
              {GROUP_LABELS[g]}{n ? ` (${n})` : ""}
            </Link>
          );
        })}
      </nav>

      {items.length === 0 && <Empty>لا بنود هنا.</Empty>}

      {returned.length > 0 && (
        <Card title="أُرجعت إليك للتعديل" className="mb-4 border-ink">
          <p className="text-xs text-muted -mt-2 mb-1">أرجعها مدير المشروع بملاحظته. تُحسب على موعدها الأصلي، ولا تدخل في درجتك حتى تعيدها.</p>
          <ObligationList items={returned} now={now} />
        </Card>
      )}
      {overdue.length > 0 && (
        <Card title={`متأخرة (${overdue.length})`} className="mb-4 border-ink">
          <ObligationList items={overdue} now={now} />
        </Card>
      )}
      {due.length > 0 && (
        <Card title="مطلوبة هذا الأسبوع" className="mb-4">
          <ObligationList items={due} now={now} />
        </Card>
      )}
      {returned.length + overdue.length + due.length === 0 && items.length > 0 && (
        <div className="card card-muted text-sm mb-4">لا شيء مطلوب منك الآن. أحسنت.</div>
      )}
      {upcoming.length > 0 && (
        <details className="card mb-4">
          <summary className="cursor-pointer text-lg">قادمة ({upcoming.length})</summary>
          <div className="mt-2"><ObligationList items={upcoming} now={now} /></div>
        </details>
      )}
      {done.length > 0 && (
        <details className="card mb-4">
          <summary className="cursor-pointer text-lg">منجزة ({done.length})</summary>
          <div className="mt-2"><ObligationList items={done} now={now} /></div>
        </details>
      )}

      <p className="text-xs text-muted mt-6">
        المهمة التطبيقية تُرفع وتُقيَّم من ستّ عشرة، والتقرير الأسبوعي تقريرٌ ذاتي عن الأسبوع كلِّه يُكتب كل خميس، والورد يُسجَّل في بطاقات القراءة ويُحسب بصفحاته مقابل نصاب الجدول.
      </p>
    </>
  );
}
