import { test } from "node:test";
import assert from "node:assert/strict";
import { pagesInText } from "../src/lib/reading-quota";
import { fieldPlan } from "../src/lib/obligations";
import { lateDays } from "../src/lib/pause";
import { at, week, weeks } from "./fixtures";

test("صفحات الورد من نصّ الجدول", () => {
  assert.equal(pagesInText("المراهق (ص 71–132)"), 62);
  assert.equal(pagesInText("من ص 10 إلى ص 20"), 11);
  assert.equal(pagesInText("ص 10-20، 30-40"), 22);
  assert.equal(pagesInText("ص ١٠–٢٠"), 11);
  assert.equal(pagesInText("الأسبوع 3"), null);
  assert.equal(pagesInText("قراءة حرة"), null);
});

test("خطة ساعات المعايشة تراكمية على أسابيعها", () => {
  const ws = weeks();
  const end = at(week(ws, 14).gregorian, 10);
  const plan = fieldPlan(ws, end, 0);
  assert.deepEqual(plan.steps.map((s) => s.need), [1, 2, 4, 5, 6, 7, 8, 10, 11, 12]);
  assert.equal(plan.soFar, 12);
  // ومن انضمّ بعد أسبوع المعايشة الأول يسقط عنه مطلوبه
  const late = fieldPlan(ws, end, at(week(ws, 4).gregorian, 0).getTime());
  assert.equal(late.total, 11);
});

test("أيام الإيقاف لا تُحسب تأخيراً", () => {
  const due = new Date("2026-10-01T19:00:00Z");
  const now = new Date("2026-10-11T09:00:00Z");
  const plain = lateDays(due, now, undefined);
  const paused = lateDays(due, now, { since: null, reason: null, until: null, past: [{ at: Date.parse("2026-10-03T09:00:00Z"), end: Date.parse("2026-10-10T09:00:00Z"), ms: 7 * 86400000 }] });
  assert.equal(plain - paused, 7);
});
