"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NAV_CANCELLED } from "@/components/shell/NavProgress";

type Draft = { v: Record<string, string>; at: number };
type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const PREFIX = "maalem-draft:";
/** مسودةٌ أقدم من أسبوع لا تُعرض: كُتب بعدها ما يغني عنها */
const MAX_AGE = 7 * 86400000;
/** علامة «أُرسل هذا النموذج للتوّ» تصلح دقيقتين: انقطاعٌ بلا ردّ لا يُبقيها فتُنسب إليه نتيجةُ نموذجٍ آخر */
const SENT_AGE = 2 * 60000;

/** حقول النموذج النصّية والاختيارية — لا المخفيّة ولا الأزرار ولا الملفات ولا المعطّلة */
function fieldsOf(form: HTMLFormElement): Field[] {
  return (Array.from(form.elements) as unknown as Field[]).filter((el) => {
    if (!el.name || el.disabled) return false;
    if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
    return el.tagName === "INPUT" && ["text", "url", "number", "date", "search", "email", "tel"].includes((el as HTMLInputElement).type);
  });
}

/** ما في الحقول الآن */
function current(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of fieldsOf(form)) out[el.name] = el.value;
  return out;
}

/**
 * ما حفظه الخادم: القيمة الافتراضية التي رُسم بها الحقل. هي المرجع لـ«ما لم يُحفظ»
 * لا ما كان في الحقول حين فُتحت الصفحة — نجاحُ نموذجٍ آخر في الصفحة نفسها يعيد
 * رسمها والحقولُ ما زالت تحمل ما كُتب ولم يُحفظ.
 */
function saved(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of fieldsOf(form)) {
    if (el.tagName === "SELECT") {
      const opts = Array.from((el as HTMLSelectElement).options) as unknown as { value: string; defaultSelected: boolean }[];
      out[el.name] = (opts.find((o) => o.defaultSelected) ?? opts[0])?.value ?? "";
    } else {
      out[el.name] = (el as HTMLInputElement | HTMLTextAreaElement).defaultValue;
    }
  }
  return out;
}

const same = (a: Record<string, string>, b: Record<string, string>) => Object.keys({ ...a, ...b }).every((k) => (a[k] ?? "") === (b[k] ?? ""));

function storage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function read(key: string): Draft | null {
  try {
    const raw = storage("local")?.getItem(PREFIX + key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d || typeof d.at !== "number" || !d.v || Date.now() - d.at > MAX_AGE) return null;
    return d;
  } catch {
    return null;
  }
}

function write(key: string, v: Record<string, string>) {
  try {
    storage("local")?.setItem(PREFIX + key, JSON.stringify({ v, at: Date.now() } satisfies Draft));
  } catch {
    // امتلأ التخزين أو مُنع: تبقى الصفحة تعمل بلا مسودة
  }
}

function drop(key: string) {
  try {
    storage("local")?.removeItem(PREFIX + key);
  } catch {
    // لا تخزين متاح
  }
}

/** أُرسل هذا النموذج بعينه للتوّ؟ — فنتيجةُ الصفحة (`ok`/`err`) نتيجتُه هو لا نتيجةُ نموذجٍ جاره */
function takeSent(key: string): boolean {
  const s = storage("session");
  try {
    const at = Number(s?.getItem(PREFIX + "sent:" + key) ?? 0);
    s?.removeItem(PREFIX + "sent:" + key);
    return at > 0 && Date.now() - at < SENT_AGE;
  } catch {
    return false;
  }
}

function markSent(key: string) {
  try {
    storage("session")?.setItem(PREFIX + "sent:" + key, String(Date.now()));
  } catch {
    // لا تخزين متاح
  }
}

/**
 * مسودة النموذج الطويل في الجهاز ريثما يُحفظ — التقرير الأسبوعي، وتسليم المهمة،
 * والخطة، والمشروع:
 *
 * - رفض الحفظ لنقصٍ ما كان يعيد النموذج بقيمه المحفوظة سابقاً، فيضيع ما كُتب للتوّ.
 *   فإن عاد هذا النموذج بخطأ (`?err=`) أُعيد ما كُتب كما كان.
 * - ومن غادر الصفحة وفي النموذج ما لم يُحفظ سُئل أولاً، ووجد مسودته إن عاد.
 * - وتُمحى المسودة حين يُحفظ هذا النموذج نفسه (`?ok=` بعد إرساله)، لا حين ينجح
 *   نموذجٌ آخر في الصفحة — كالوقفة التدبرية تحت الخطة.
 *
 * والمسودة في جهاز صاحبها وحده (localStorage)، ومفتاحها يحمل معرّفه، فلا تظهر
 * لغيره على جهازٍ مشترك. والنموذج المقفل (مهمةٌ قُيّمت، مشروعٌ حُكِّم) لا مسودة له.
 */
export default function DraftKeeper(props: { formId: string; storageKey: string }) {
  // يقرأ معاملات الرابط، فيُعزل في حدّ تعليقٍ لا يلفّ غيره
  return (
    <Suspense fallback={null}>
      <Keeper {...props} />
    </Suspense>
  );
}

function Keeper({ formId, storageKey }: { formId: string; storageKey: string }) {
  const [offer, setOffer] = useState<Draft | null>(null);
  const [restored, setRestored] = useState(false);
  /**
   * المعاملات كما صُيّرت بها الصفحة لا كما في الشريط ساعةَ الأثر: رسالة الحفظ
   * تمحو `ok` و`err` من الشريط بعد عرضها. والأثر يُعاد مع كل تبدّلٍ فيها، فالإجراء
   * يعود إلى الصفحة نفسها والمكوّن مركَّبٌ.
   */
  const search = useSearchParams();
  const flag = search.has("ok") ? "ok" : search.has("err") ? "err" : "";

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    // نموذجٌ مقفلٌ كله: لا يُكتب فيه شيء، فلا مسودة تُعرض عليه ولا تبقى
    if (fieldsOf(form).length === 0) {
      drop(storageKey);
      return;
    }
    let submitting = false;
    const sent = flag ? takeSent(storageKey) : false;
    const draft = read(storageKey);
    if (flag === "ok" && sent) {
      drop(storageKey);
    } else if (draft && !same(draft.v, current(form))) {
      if (flag === "err" && sent) {
        apply(form, draft.v);
        setRestored(true);
      } else {
        setOffer(draft);
      }
    }

    const dirty = () => !same(current(form), saved(form));
    const persist = () => {
      if (dirty()) write(storageKey, current(form));
      else drop(storageKey);
    };
    let t: number | null = null;
    const save = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(persist, 400);
    };
    const onSubmit = () => {
      // ما كُتب في اللحظة الأخيرة قبل الإرسال يُحفظ الآن، فرفضٌ سريعٌ لا يسبقه
      if (t) window.clearTimeout(t);
      persist();
      markSent(storageKey);
      submitting = true;
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (submitting || !dirty()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    // الانتقال داخل التطبيق لا يُطلق beforeunload: يُسأل عنه عند النقر على رابط
    const onClick = (e: MouseEvent) => {
      if (submitting || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return;
      if (form.contains(a)) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!dirty()) return;
      persist();
      if (!window.confirm("في النموذج ما لم يُحفظ بعد. تبقى مسودته في جهازك وتجدها إن عدت. أتغادر الصفحة؟")) {
        (e as MouseEvent & { [NAV_CANCELLED]?: boolean })[NAV_CANCELLED] = true;
        e.preventDefault();
        e.stopPropagation();
      }
    };
    form.addEventListener("input", save);
    form.addEventListener("change", save);
    form.addEventListener("submit", onSubmit);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      if (t) window.clearTimeout(t);
      form.removeEventListener("input", save);
      form.removeEventListener("change", save);
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [formId, storageKey, flag]);

  if (restored) {
    return <p className="text-xs text-muted mb-2" role="status">أُعيد ما كتبته قبل أن يُرفض الحفظ — صحّح المطلوب ثم احفظ.</p>;
  }
  if (!offer) return null;
  return (
    <div className="card card-muted text-sm mb-3 flex flex-wrap items-center justify-between gap-2" role="status">
      <span>لك مسودة لم تُحفظ من {new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" }).format(offer.at)}.</span>
      <span className="flex gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const form = document.getElementById(formId) as HTMLFormElement | null;
            if (form) apply(form, offer.v);
            setOffer(null);
          }}
        >
          استعدها
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            drop(storageKey);
            setOffer(null);
          }}
        >
          تجاهلها
        </button>
      </span>
    </div>
  );
}

/** يكتب قيم المسودة في حقولها، ويُطلق حدث الإدخال فتتبعها أي واجهةٍ تُصغي إليها */
function apply(form: HTMLFormElement, values: Record<string, string>) {
  for (const el of fieldsOf(form)) {
    if (!(el.name in values)) continue;
    el.value = values[el.name];
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}
