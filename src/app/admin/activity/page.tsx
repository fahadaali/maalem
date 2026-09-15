import Link from "@/components/Link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { undoActivity, restoreActivity } from "../actions";
import { ACTIVITY_KINDS, buildActivity, isActivityKind, type ActivityBy } from "@/lib/activity";
import { participantsWhere } from "@/lib/cohort";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "مركز الأنشطة" };

const BY_LABELS: Record<ActivityBy, string> = { PARTICIPANT: "المشاركون", ADMIN: "مدير المشروع" };

export default async function ActivityCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; by?: string; user?: string; ok?: string; err?: string }>;
}) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const kind = sp.kind && isActivityKind(sp.kind) ? sp.kind : undefined;
  const by = sp.by === "PARTICIPANT" || sp.by === "ADMIN" ? sp.by : undefined;
  const userId = sp.user || undefined;

  const [items, people, undone] = await Promise.all([
    buildActivity({ kind, by, userId, limit: 60 }),
    db.user.findMany({ where: await participantsWhere(), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.undoEntry.findMany({ orderBy: { undoneAt: "desc" }, take: 20 }),
  ]);
  // وجهة العودة بعد التراجع: الصفحة بتصفيتها نفسها، فلا يضيع موضع المدير من القائمة
  const qs = new URLSearchParams();
  if (kind) qs.set("kind", kind);
  if (by) qs.set("by", by);
  if (userId) qs.set("user", userId);
  const back = `/admin/activity${qs.size ? `?${qs}` : ""}`;

  return (
    <>
      <PageHeader
        title="مركز الأنشطة"
        subtitle="كل ما أُدخل في المنصة مرتباً من الأحدث — ما سجّله المشاركون وما رصده مدير المشروع عليهم. تراجَعْ عن أي إدخال خاطئ، وأعِدْه إن تراجعتَ عنه سهواً."
      />
      <FormMessage ok={sp.ok} err={sp.err} />

      <Card title="تصفية" className="mb-4">
        <form className="grid md:grid-cols-4 gap-3 items-end" action="/admin/activity">
          <div className="field mb-0">
            <label className="label">المُدخِل</label>
            <select name="by" className="select" defaultValue={by ?? ""}>
              <option value="">الكل</option>
              <option value="PARTICIPANT">{BY_LABELS.PARTICIPANT}</option>
              <option value="ADMIN">{BY_LABELS.ADMIN}</option>
            </select>
          </div>
          <div className="field mb-0">
            <label className="label">نوع الإدخال</label>
            <select name="kind" className="select" defaultValue={kind ?? ""}>
              <option value="">الكل</option>
              {Object.entries(ACTIVITY_KINDS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="field mb-0">
            <label className="label">المشارك</label>
            <select name="user" className="select" defaultValue={userId ?? ""}>
              <option value="">الكل</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <SubmitButton secondary pendingText="جارٍ العرض…">عرض</SubmitButton>
        </form>
      </Card>

      <Card title={`أحدث الإدخالات${items.length ? ` (${items.length})` : ""}`} className="mb-4">
        {items.length === 0 ? (
          <Empty>لا إدخالات بهذه التصفية.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((e) => {
              const spec = ACTIVITY_KINDS[e.kind];
              return (
                <li key={`${e.kind}:${e.id}`} className="py-3 flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted">
                      {formatDateTime(e.at)} · {spec.label} · <Badge tone={spec.by === "ADMIN" ? "ink" : "soft"}>{BY_LABELS[spec.by]}</Badge>
                    </div>
                    <div className="text-sm font-medium mt-1">
                      <Link href={`/admin/participants/${e.userId}`} className="hover:underline">{e.userName}</Link>
                      {" — "}
                      {e.href ? <Link href={e.href} className="hover:underline">{e.title}</Link> : e.title}
                    </div>
                    {e.detail && <div className="text-sm text-muted whitespace-pre-wrap">{e.detail}</div>}
                  </div>
                  <form action={undoActivity} className="shrink-0">
                    <input type="hidden" name="kind" value={e.kind} />
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="back" value={back} />
                    <SubmitButton
                      secondary
                      className="btn-sm"
                      pendingText="جارٍ التراجع…"
                      confirm={`التراجع عن «${e.title}» لـ${e.userName}؟\n\n${spec.undoNote}.\nيبقى في سجل التراجع أسفل الصفحة فتستطيع إعادته.`}
                    >
                      تراجع
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="سجل التراجع">
        <p className="text-xs text-muted mb-3">
          ما تراجعتَ عنه محفوظٌ كما كان. «إعادة» تُرجع الإدخال بمعرّفه نفسه — إلا أن يكون المشارك قد أدخل بديلاً عنه، فيُراجَع في صفحته أولاً.
        </p>
        {undone.length === 0 ? (
          <Empty>لم تتراجع عن شيء بعد.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {undone.map((u) => (
              <li key={u.id} className="py-3 flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted">
                    {formatDateTime(u.undoneAt)} · {ACTIVITY_KINDS[u.kind]?.label ?? u.kind} · تراجَع: {u.undoneBy}
                  </div>
                  <div className="text-sm font-medium mt-1">{u.userName} — {u.label}</div>
                  {u.detail && <div className="text-sm text-muted whitespace-pre-wrap">{u.detail}</div>}
                  <div className="text-xs text-muted mt-1">الإدخال الأصلي: {formatDateTime(u.at)}</div>
                </div>
                {u.restoredAt ? (
                  <Badge className="shrink-0">أُعيد · {formatDateTime(u.restoredAt)}</Badge>
                ) : (
                  <form action={restoreActivity} className="shrink-0">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="back" value={back} />
                    <SubmitButton className="btn-sm" pendingText="جارٍ الإعادة…">إعادة</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
