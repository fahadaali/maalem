"use client";

import { useState } from "react";
import { QUESTION_KINDS, TRUE_FALSE_OPTIONS } from "@/lib/quiz";

/** حقول سؤال واحد، تتبدل بحسب نوعه: اختيار من متعدد، أو صواب وخطأ، أو إجابة قصيرة */
export default function QuestionFields({ showBankFields, weeks }: { showBankFields?: boolean; weeks?: { number: number; label: string }[] }) {
  const [kind, setKind] = useState<string>("MCQ");
  return (
    <>
      <div className="field">
        <label className="label">نوع السؤال</label>
        <select name="kind" className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(QUESTION_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="field"><label className="label">نص السؤال</label><textarea name="text" className="textarea" rows={2} required /></div>

      {kind === "MCQ" && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="field flex items-center gap-2">
              <input type="radio" name="correctIndex" value={i} required={i === 0} className="accent-black" title="الإجابة الصحيحة" />
              <input name={`opt${i}`} className="input" placeholder={`الخيار ${i + 1}${i > 1 ? " (اختياري)" : ""}`} required={i < 2} />
            </div>
          ))}
          <p className="text-xs text-muted mb-3">حدد الدائرة بجانب الإجابة الصحيحة.</p>
        </>
      )}

      {kind === "TRUEFALSE" && (
        <div className="field">
          <label className="label">الإجابة الصحيحة</label>
          <div className="flex gap-4">
            {TRUE_FALSE_OPTIONS.map((o, i) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input type="radio" name="correctIndex" value={i} required className="accent-black" /> {o}
              </label>
            ))}
          </div>
        </div>
      )}

      {kind === "SHORT" && (
        <div className="field">
          <label className="label">الإجابات المقبولة</label>
          <input name="answers" className="input" required placeholder="صلاة العصر | العصر" />
          <p className="text-xs text-muted mt-1">
            يفصل بين صور الإجابة الحرف |. التصحيح يتجاوز التشكيل وصور الألف والياء والتاء المربوطة وعلامات الترقيم.
          </p>
        </div>
      )}

      <div className="field">
        <label className="label">شرح الإجابة (يظهر للمشارك بعد التسليم)</label>
        <textarea name="explanation" className="textarea !min-h-[3.2rem]" rows={2} />
      </div>

      {showBankFields && (
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label className="label">التصنيف</label>
            <select name="topic" className="select"><option value="FIQH">فقه</option><option value="QURAN">قرآن</option><option value="OTHER">أخرى</option></select>
          </div>
          <div className="field">
            <label className="label">الأسبوع</label>
            <select name="week" className="select" defaultValue="">
              <option value="">—</option>
              {(weeks ?? []).map((w) => <option key={w.number} value={w.number}>{w.label}</option>)}
            </select>
          </div>
        </div>
      )}
    </>
  );
}
