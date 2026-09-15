import { requireRole } from "@/lib/auth";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { deleteHelpItem, moveHelpItem, saveHelpItem } from "../actions";
import { HELP_AUDIENCES, allHelp, ensureHelpSeed, type HelpAudience, type HelpItemView } from "@/lib/help";

export const metadata = { title: "مركز المساعدة" };

export default async function AdminHelpPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  await ensureHelpSeed();
  const { ok, err } = await searchParams;
  const items = await allHelp();
  const groups = (Object.keys(HELP_AUDIENCES) as HelpAudience[]).map((a) => ({ audience: a, items: items.filter((x) => x.audience === a) }));

  return (
    <>
      <PageHeader
        title="مركز المساعدة"
        subtitle="أسئلة الاستعمال وأجوبتها كما يقرؤها أصحابها. لكل سؤال جمهوره: «لكل من دخل» يراه الجميع، وما عداه لا يراه إلا صاحب دوره."
      />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.audience}>
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-lg">{HELP_AUDIENCES[g.audience]}</h2>
                <span className="text-xs text-muted">{g.items.length} سؤال</span>
              </div>
              {g.items.length === 0 ? (
                <p className="text-sm text-muted ps-3">لا أسئلة لهذا الجمهور.</p>
              ) : (
                <div className="space-y-3">
                  {g.items.map((x, i) => (
                    <Card key={x.id}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium">{x.question}</div>
                          <p className="text-sm text-muted mt-1">{x.answer}</p>
                          {x.href && <div className="text-xs text-muted mt-1" dir="ltr">{x.href}{x.hrefLabel ? ` · ${x.hrefLabel}` : ""}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <MoveButton id={x.id} dir="up" disabled={i === 0} label="تقديم" />
                          <MoveButton id={x.id} dir="down" disabled={i === g.items.length - 1} label="تأخير" />
                          <Badge tone="soft">{HELP_AUDIENCES[g.audience]}</Badge>
                        </div>
                      </div>
                      <details className="mt-3 text-sm">
                        <summary className="cursor-pointer text-muted">تعديل</summary>
                        <form action={saveHelpItem} className="mt-2">
                          <input type="hidden" name="id" value={x.id} />
                          <HelpFields item={x} />
                          <SubmitButton secondary className="btn-sm">حفظ</SubmitButton>
                        </form>
                        <form action={deleteHelpItem} className="mt-2">
                          <input type="hidden" name="id" value={x.id} />
                          <SubmitButton ghost className="btn-sm text-muted" pendingText="جارٍ الحذف…" confirm={`حذف «${x.question}»؟`}>
                            حذف السؤال
                          </SubmitButton>
                        </form>
                      </details>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          ))}
          {items.length === 0 && <Empty>لا أسئلة بعد.</Empty>}
        </div>

        <Card title="سؤال جديد">
          <form action={saveHelpItem}>
            <HelpFields />
            <SubmitButton className="btn-sm" pendingText="جارٍ الإضافة…">إضافة السؤال</SubmitButton>
          </form>
          <p className="text-xs text-muted mt-3 border-t border-line pt-3">
            الرابط اختياري، ولا يُقبل إلا مسارٌ داخل المنصة يبدأ بـ «/» — فلا يقود سؤالُ مساعدةٍ إلى موقع خارجي.
          </p>
        </Card>
      </div>
    </>
  );
}

function HelpFields({ item }: { item?: HelpItemView }) {
  return (
    <>
      <div className="field">
        <label className="label">الجمهور</label>
        <select name="audience" className="select" defaultValue={item?.audience ?? "ALL"}>
          {Object.entries(HELP_AUDIENCES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="label">السؤال</label>
        <input name="question" className="input" required maxLength={160} defaultValue={item?.question ?? ""} />
      </div>
      <div className="field">
        <label className="label">الجواب</label>
        <textarea name="answer" className="textarea" rows={3} required defaultValue={item?.answer ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label className="label">رابط داخل المنصة</label>
          <input name="href" className="input" dir="ltr" placeholder="/app/settings" defaultValue={item?.href ?? ""} />
        </div>
        <div className="field">
          <label className="label">نص الرابط</label>
          <input name="hrefLabel" className="input" maxLength={40} defaultValue={item?.hrefLabel ?? ""} />
        </div>
      </div>
    </>
  );
}

function MoveButton({ id, dir, disabled, label }: { id: string; dir: "up" | "down"; disabled: boolean; label: string }) {
  return (
    <form action={moveHelpItem}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dir" value={dir} />
      <button type="submit" disabled={disabled} className="btn btn-ghost btn-sm px-1.5 disabled:opacity-30" aria-label={label} title={label}>
        {dir === "up" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
    </form>
  );
}
