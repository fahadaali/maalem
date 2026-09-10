"use client";

import { useState } from "react";
import { EXCUSE_KINDS } from "@/lib/excuses";

/** حقول طلب الاستئذان: أسبوع للاستئذان عن لقاء، ومهمة وتاريخ لتأجيل التسليم */
export default function ExcuseForm({
  weeks, assignments, currentWeek, today,
}: {
  weeks: { number: number; label: string }[];
  assignments: { id: string; title: string; week: number }[];
  currentWeek: number;
  today: string;
}) {
  const [kind, setKind] = useState<string>("ABSENCE_INPERSON");
  return (
    <>
      <div className="field">
        <label className="label">نوع الطلب</label>
        <select name="kind" className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(EXCUSE_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {kind === "EXTENSION" ? (
        <>
          <div className="field">
            <label className="label">المهمة</label>
            <select name="assignmentId" className="select" required>
              <option value="">— اختر —</option>
              {assignments.map((a) => <option key={a.id} value={a.id}>الأسبوع {a.week}: {a.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">التأجيل إلى</label>
            <input type="date" name="until" className="input" dir="ltr" required defaultValue={today} />
          </div>
        </>
      ) : (
        <div className="field">
          <label className="label">الأسبوع</label>
          <select name="week" className="select" defaultValue={String(currentWeek)} required>
            {weeks.map((w) => <option key={w.number} value={w.number}>{w.label}</option>)}
          </select>
        </div>
      )}
      <div className="field">
        <label className="label">السبب</label>
        <textarea name="reason" className="textarea" rows={3} required minLength={10} placeholder="اذكر عذرك بوضوح" />
      </div>
    </>
  );
}
