import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Empty, Badge } from "@/components/ui";
import { MINUTES_LABELS } from "@/lib/utils";
import { formatShort } from "@/lib/dates";
import { cohortWhere } from "@/lib/cohort";

export const metadata = { title: "محاضر اللقاءات" };

export default async function ParticipantMinutesPage() {
  await requireParticipantView();
  const rows = await db.sessionMinutes.findMany({ where: await cohortWhere(), orderBy: [{ week: "asc" }, { type: "asc" }] });
  return (
    <>
      <PageHeader title="محاضر اللقاءات" subtitle="ما دار في اللقاءات الحضورية وحلقات النقاش، وقراراتها وتكاليفها." />
      {rows.length === 0 ? (
        <Empty>لم تُنشر محاضر بعد.</Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((m) => (
            <Card key={m.id} title={m.title || MINUTES_LABELS[m.type]} action={<Badge tone="soft">الأسبوع {m.week}</Badge>}>
              <div className="text-xs text-muted mb-2">
                {MINUTES_LABELS[m.type]} · {formatShort(m.date)}
                {m.guestName ? ` · الضيف: ${m.guestName}` : ""}
              </div>
              <div className="text-sm whitespace-pre-wrap">{m.minutes}</div>
              {m.decisions && (
                <div className="mt-2 border-t border-line pt-2">
                  <div className="text-xs text-muted">القرارات والتكاليف</div>
                  <div className="text-sm whitespace-pre-wrap">{m.decisions}</div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
