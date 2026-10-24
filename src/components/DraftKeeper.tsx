"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Draft = { v: Record<string, string>; at: number };

const PREFIX = "maalem-draft:";
/** مسودةٌ أقدم من أسبوع لا تُعرض: كُتب بعدها ما يغني عنها */
const MAX_AGE = 7 * 86400000;

/** حقول النموذج النصّية والاختيارية بقيمها — لا المخفيّة ولا الأزرار ولا الملفات */
function fieldsOf(form: HTMLFormElement): (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[] {
  return (Array.from(form.elements) as unknown as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[]).filter((el) => {
    if (!el.name || el.disabled) return false;
    if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
    return el.tagName === "INPUT" && ["text", "url", "number", "date", "search", "email", "tel"].includes((el as HTMLInputElement).type);
  });
}

function snapshot(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of fieldsOf(form)) out[el.name] = el.value;
  return out;
}

const same = (a: Record<string, string>, b: Record<string, string>) => Object.keys({ ...a, ...b }).every((k) => (a[k] ?? "") === (b[k] ?? ""));

function read(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d || typeof d.at !== "number" || Date.now() - d.at > MAX_AGE) return null;
    return d;
  } catch {
    return null;
  }
}

function drop(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // لا تخزين متاح
  }
}

/**
 * مسودة النموذج الطويل في الجهاز ريثما يُحفظ — التقرير الأسبوعي، وتسليم المهمة،
 * والخطة، والمشروع:
 *
 * - رفض الحفظ لنقصٍ ما كان يعيد النموذج بقيمه المحفوظة سابقاً، فيضيع ما كُتب للتوّ.
 *   فإن عاد الإجراء بخطأ (`?err=`) أُعيد ما كُتب كما كان.
 * - ومن غادر الصفحة وفي النموذج ما لم يُحفظ سُئل أولاً، ووجد مسودته إن عاد.
 * - وتُمحى المسودة حين يعود الإجراء بنجاح (`?ok=`).
 *
 * والمسودة في جهاز صاحبها وحده (localStorage)، ومفتاحها يحمل معرّفه، فلا تظهر
 * لغيره على جهازٍ مشترك.
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
  const initial = useRef<Record<string, string>>({});
  const submitting = useRef(false);
  /**
   * المعاملات كما صُيّرت بها الصفحة لا كما في الشريط ساعةَ الأثر: رسالة الحفظ
   * تمحو `ok` و`err` من الشريط بعد عرضها. والأثر يُعاد مع كل تبدّلٍ فيها — الإجراء
   * يعود إلى الصفحة نفسها والمكوّن مركَّبٌ — فيُقاس «ما لم يُحفظ» من المحفوظ الجديد.
   */
  const search = useSearchParams();
  const flag = search.has("ok") ? "ok" : search.has("err") ? "err" : "";

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    submitting.current = false;
    initial.current = snapshot(form);
    const draft = read(storageKey);
    if (flag === "ok") {
      drop(storageKey);
    } else if (draft && !same(draft.v, initial.current)) {
      if (flag === "err") {
        apply(form, draft.v);
        setRestored(true);
      } else {
        setOffer(draft);
      }
    }

    let t: number | null = null;
    const dirty = () => !same(snapshot(form), initial.current);
    const save = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => {
        try {
          if (dirty()) localStorage.setItem(PREFIX + storageKey, JSON.stringify({ v: snapshot(form), at: Date.now() } satisfies Draft));
          else drop(storageKey);
        } catch {
          // امتلأ التخزين أو مُنع: تبقى الصفحة تعمل بلا مسودة
        }
      }, 500);
    };
    const onSubmit = () => {
      submitting.current = true;
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (submitting.current || !dirty()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    // الانتقال داخل التطبيق لا يُطلق beforeunload: يُسأل عنه عند النقر على رابط
    const onClick = (e: MouseEvent) => {
      if (submitting.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
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
      if (!window.confirm("في النموذج ما لم يُحفظ بعد. تبقى مسودته في جهازك وتجدها إن عدت. أتغادر الصفحة؟")) {
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
