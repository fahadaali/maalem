import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { deleteGuest, saveGuest } from "../actions";
import { getWeeks } from "@/lib/weeks";
import { RISKS } from "@/lib/program";
import { cohortWhere } from "@/lib/cohort";

export const metadata = { title: "الخبراء والضيوف" };

const STATUS: Record<string, string> = {
  CANDIDATE: "مرشّح",
  CONFIRMED: "مؤكّد",
  DONE: "تم اللقاء",
  DECLINED: "اعتذر",
};

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const [guests, weeks] = await Promise.all([
    db.guest.findMany({ where: await cohortWhere(), orderBy: [{ week: "asc" }, { backup: "asc" }, { createdAt: "asc" }] }),
    getWeeks(),
  ]);
  const risk = RISKS.find((r) => r.risk.includes("الخبير"));

  return (
    <>
      <PageHeader
        title="الخبراء وضيوف اللقاءات"
        subtitle="اللقاءان الشهريان يحتاجان خبيراً ولكلٍّ بديل. سجّل المرشّحين وحدّث حالتهم حتى لا يتعطّل لقاء."
      />
      <FormMessage ok={ok} err={err} />
      {risk && <div className="card card-muted text-sm mb-4"><span className="font-medium">من سجل المخاطر: </span>{risk.response}</div>}
      <div className="grid md:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="space-y-2">
          {guests.length === 0 ? (
            <Empty>لا ضيوف مسجّلون. ابدأ بخبيرَي اللقاءين الشهريين (الأسبوع 4 والأسبوع 9) وبديلَيهما.</Empty>
          ) : (
            guests.map((g) => (
              <Card key={g.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{g.name} {g.backup && <span className="badge badge-soft">بديل</span>}</div>
                    <div className="text-xs text-muted">
                      {g.topic}
                      {g.week != null ? ` · الأسبوع ${g.week}` : ""}
                      {g.contact ? ` · ${g.contact}` : ""}
                    </div>
                  </div>
                  <Badge tone={g.status === "CONFIRMED" || g.status === "DONE" ? "ink" : "default"}>{STATUS[g.status]}</Badge>
                </div>
                {g.notes && <p className="text-sm text-muted mt-1">{g.notes}</p>}
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-muted">تعديل</summary>
                  <form action={saveGuest} className="mt-2">
                    <input type="hidden" name="id" value={g.id} />
                    <GuestFields guest={g} weeks={weeks} />
                    <SubmitButton secondary className="btn-sm">حفظ</SubmitButton>
                  </form>
                  <form action={deleteGuest} className="mt-2">
                    <input type="hidden" name="id" value={g.id} />
                    <button className="btn btn-ghost btn-sm text-muted">حذف</button>
                  </form>
                </details>
              </Card>
            ))
          )}
        </div>
        <Card title="إضافة ضيف">
          <form action={saveGuest}>
            <GuestFields weeks={weeks} />
            <SubmitButton>إضافة</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}

type G = { name: string; topic: string; week: number | null; contact: string | null; status: string; backup: boolean; notes: string | null };

function GuestFields({ guest, weeks }: { guest?: G; weeks: { number: number; label: string }[] }) {
  return (
    <>
      <div className="field"><label className="label">الاسم</label><input name="name" className="input" required defaultValue={guest?.name ?? ""} /></div>
      <div className="field"><label className="label">الموضوع</label><input name="topic" className="input" required defaultValue={guest?.topic ?? ""} placeholder="القيم التربوية" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label className="label">الأسبوع</label>
          <select name="week" className="select" defaultValue={guest?.week ?? ""}>
            <option value="">—</option>
            {weeks.filter((w) => w.number >= 0 && w.number <= 13).map((w) => <option key={w.number} value={w.number}>الأسبوع {w.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">الحالة</label>
          <select name="status" className="select" defaultValue={guest?.status ?? "CANDIDATE"}>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label className="label">وسيلة التواصل</label><input name="contact" className="input" dir="ltr" defaultValue={guest?.contact ?? ""} /></div>
      <div className="field"><label className="label">ملاحظات</label><textarea name="notes" className="textarea" rows={2} defaultValue={guest?.notes ?? ""} /></div>
      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" name="backup" className="accent-black" defaultChecked={guest?.backup ?? false} /> ضيف بديل
      </label>
    </>
  );
}
