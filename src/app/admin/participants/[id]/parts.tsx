import Link from "@/components/Link";
import type { ReactNode } from "react";
import { CheckCheck, MessageSquareText, Pencil, RotateCcw, Trash2, Undo2 } from "lucide-react";
import ItemMenu from "@/components/ItemMenu";
import SubmitButton from "@/components/SubmitButton";
import { undoActivity } from "../../actions";
import { cancelReturn, editItem, returnItem, reviewItem } from "../actions";
import { ITEM_FIELDS, fieldValue, itemAnchor, type FileTab } from "@/lib/items";
import { RETURN_KINDS, type OpenReturn, type ReturnKind } from "@/lib/returns";
import { formatDateTime, todayKey } from "@/lib/dates";
import { daysLate, overdueLabel } from "@/lib/obligations";

/**
 * أجزاء ملف المشارك عند المدير: قائمة ⋮ على كل عنصر، واللوحات التي تفتحها تحته —
 * تعديلٌ أو مراجعةٌ أو إرجاع — نماذجَ خادم تعود إلى العنصر نفسه.
 */

export type Panel = { mode: "edit" | "review" | "ret"; kind: string; id: string } | null;

/** «?edit=READING_CARD:abc» إلى لوحةٍ مفتوحة */
export function parsePanel(sp: { edit?: string; review?: string; ret?: string }): Panel {
  for (const mode of ["edit", "review", "ret"] as const) {
    const v = sp[mode];
    if (!v) continue;
    const i = v.indexOf(":");
    if (i > 0) return { mode, kind: v.slice(0, i), id: v.slice(i + 1) };
  }
  return null;
}

/** مسارات العنصر في الملف: الرجوع إليه، وفتح لوحةٍ تحته */
export function itemLinks(userId: string, tab: FileTab, kind: string, id: string) {
  const anchor = itemAnchor(kind, id);
  const base = `/admin/participants/${userId}?tab=${tab}`;
  return {
    anchor,
    // `focus` يعود به إلى العنصر بعد الحفظ: المرساة وحدها تضيع في تحويل الإجراء
    back: `${base}&focus=${anchor}#${anchor}`,
    close: `${base}#${anchor}`,
    open: (mode: "edit" | "review" | "ret") => `${base}&${mode}=${kind}:${encodeURIComponent(id)}#${anchor}`,
  };
}

const row = "w-full text-start flex items-center gap-2 px-3 py-2 hover:bg-paper-2";

/** بندُ رابطٍ في القائمة — يفتح لوحةً تحت العنصر */
function MenuLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link href={href} prefetch={false} scroll={false} role="menuitem" className={row}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}

/**
 * قائمة ⋮ لإدخالٍ من إدخالات المشارك. `kind` نوعه في سجلّ الإرجاع (إن كان مما
 * يُرجَع)، و`activity` نوعه في مركز الأنشطة (إن كان مما يُحذف بلقطة تُعاد منها).
 */
export function ItemActions({
  userId,
  tab,
  kind,
  activity,
  id,
  label,
  returned,
  reviewable,
  editable = true,
  returnable = true,
  extra,
}: {
  userId: string;
  tab: FileTab;
  kind?: ReturnKind;
  activity?: string;
  id: string;
  label: string;
  returned?: OpenReturn;
  reviewable?: boolean;
  editable?: boolean;
  returnable?: boolean;
  extra?: ReactNode;
}) {
  const l = itemLinks(userId, tab, kind ?? activity ?? "item", id);
  return (
    <ItemMenu label={`خيارات ${label}`}>
      {kind && editable && <MenuLink href={l.open("edit")} icon={<Pencil size={15} />}>تعديل</MenuLink>}
      {kind && reviewable && <MenuLink href={l.open("review")} icon={<MessageSquareText size={15} />}>مراجعة وملاحظة</MenuLink>}
      {extra}
      {kind && returnable && !returned && <MenuLink href={l.open("ret")} icon={<RotateCcw size={15} />}>إرجاع للتعديل</MenuLink>}
      {kind && returned && (
        <form action={cancelReturn}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="back" value={l.back} />
          <button type="submit" role="menuitem" className={row}>
            <Undo2 size={15} />
            <span>إلغاء الإرجاع</span>
          </button>
        </form>
      )}
      {activity && (
        <form action={undoActivity} className="border-t border-line mt-1 pt-1">
          <input type="hidden" name="kind" value={activity} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="back" value={`/admin/participants/${userId}?tab=${tab}`} />
          <SubmitButton ghost className={`${row} !rounded-none !justify-start`} pendingText="جارٍ الحذف…" confirm={`حذف ${label}؟\n\nتُحفظ لقطته في سجل التراجع بمركز الأنشطة فيُعاد منها، ويُشعَر صاحبه.`}>
            <Trash2 size={15} />
            <span>حذف</span>
          </SubmitButton>
        </form>
      )}
    </ItemMenu>
  );
}

/** بندٌ إضافي في القائمة: نموذجٌ لإجراءٍ قائم (اعتماد المعايشة، إعادة فتح الاختبار) */
export function MenuAction({ action, fields, children, confirm }: { action: (f: FormData) => Promise<void>; fields: Record<string, string>; children: ReactNode; confirm?: string }) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton ghost className={`${row} !rounded-none !justify-start`} pendingText="…" confirm={confirm}>
        <CheckCheck size={15} />
        <span>{children}</span>
      </SubmitButton>
    </form>
  );
}

/** شارة الإرجاع المفتوح على العنصر: متى، ومن، وما المطلوب */
export function ReturnedNote({ r, due, now }: { r: OpenReturn; due?: Date | null; now: Date }) {
  return (
    <div className="text-sm mt-2 border-s-2 border-ink ps-2">
      <div className="text-xs text-muted">
        أُرجع لصاحبه {formatDateTime(r.returnedAt)} — {r.returnedBy}
        {due && due < now ? ` · ${overdueLabel(daysLate(due, now))} عن موعده الأصلي` : ""}
      </div>
      <div className="whitespace-pre-wrap">{r.note}</div>
    </div>
  );
}

/** لوحة تحت العنصر: تعديل حقوله، أو مراجعته بملاحظة، أو إرجاعه لصاحبه */
export function ItemPanel({
  panel,
  userId,
  tab,
  kind,
  id,
  values,
  feedback,
  label,
}: {
  panel: Panel;
  userId: string;
  tab: FileTab;
  kind: ReturnKind;
  id: string;
  values?: Record<string, unknown>;
  feedback?: string | null;
  label: string;
}) {
  if (!panel || panel.kind !== kind || panel.id !== id) return null;
  const l = itemLinks(userId, tab, kind, id);
  const shell = (title: string, body: ReactNode) => (
    <div className="mt-3 rounded-xl border-2 border-ink p-4 bg-paper-2">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="font-medium">{title}</div>
        <Link href={l.close} prefetch={false} scroll={false} className="text-sm text-muted hover:text-ink">إغلاق</Link>
      </div>
      {body}
    </div>
  );

  if (panel.mode === "edit") {
    return shell(
      `تعديل ${RETURN_KINDS[kind]}`,
      <form key={`${kind}:${id}`} action={editItem}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="back" value={l.back} />
        <div className="grid sm:grid-cols-2 gap-x-3">
          {ITEM_FIELDS[kind].map((f) => {
            const v = fieldValue(values?.[f.name], f, todayKey);
            const wide = f.type === "textarea";
            return (
              <div key={f.name} className={`field ${wide ? "sm:col-span-2" : ""}`}>
                <label className="label" htmlFor={`${id}-${f.name}`}>{f.label}</label>
                {f.type === "textarea" ? (
                  <textarea id={`${id}-${f.name}`} name={f.name} className="textarea" rows={f.rows ?? 3} defaultValue={v} required={f.required} />
                ) : (
                  <input
                    id={`${id}-${f.name}`}
                    name={f.name}
                    className="input"
                    type={f.type === "url" ? "url" : f.type}
                    step={f.step}
                    min={f.type === "number" ? (f.step ? "0.5" : "1") : undefined}
                    dir={f.type === "url" ? "ltr" : undefined}
                    defaultValue={v}
                    required={f.required}
                  />
                )}
              </div>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" name="notify" defaultChecked className="accent-black" /> أشعِر صاحبه بالتعديل</label>
        <SubmitButton className="btn-sm">حفظ التعديل</SubmitButton>
      </form>,
    );
  }

  if (panel.mode === "review") {
    return shell(
      `مراجعة ${label}`,
      <form key={`${kind}:${id}:review`} action={reviewItem}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="back" value={l.back} />
        <div className="field">
          <label className="label">ملاحظة لصاحبه (اختيارية — تصله إن كُتبت)</label>
          <textarea name="feedback" className="textarea" rows={3} defaultValue={feedback ?? ""} />
        </div>
        <SubmitButton className="btn-sm">اعتماد المراجعة</SubmitButton>
      </form>,
    );
  }

  return shell(
    `إرجاع ${label} لصاحبه`,
    <form key={`${kind}:${id}:ret`} action={returnItem}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={l.back} />
      <p className="text-xs text-muted mb-2">
        يبقى ما كتبه كما هو، ويُفتح له ليعدّله ويعيده. يظهر في «مهامي» عنده أولاً بعدّاد موعده الأصلي، ولا يُحتسب في درجته حتى يعيده. ويصله إشعار الآن.
      </p>
      <div className="field">
        <label className="label">المطلوب تعديله</label>
        <textarea name="note" className="textarea" rows={3} required placeholder="مثال: الفائدة عامة — اذكر فكرة بعينها من الصفحات التي قرأتها" />
      </div>
      <SubmitButton className="btn-sm">إرجاع وإشعار صاحبه</SubmitButton>
    </form>,
  );
}

/** شارة حال العنصر في الملف */
export function stateBadge(s: { returned?: boolean; done?: boolean; pending?: boolean; late?: boolean }, labels: { returned?: string; done: string; pending: string; missing?: string }): { text: string; tone: "ink" | "soft" | "default" } {
  if (s.returned) return { text: labels.returned ?? "مُرجَع لصاحبه", tone: "ink" };
  if (s.done) return { text: labels.done, tone: "ink" };
  if (s.pending) return { text: labels.pending, tone: "default" };
  return { text: s.late ? `${labels.missing ?? "لم يُسلَّم"} — متأخر` : (labels.missing ?? "لم يُسلَّم"), tone: s.late ? "ink" : "soft" };
}
