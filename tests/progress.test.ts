import { test } from "node:test";
import assert from "node:assert/strict";
import { progressFrom, tallyText, tallyShort } from "../src/lib/progress";
import { at, graded, participant, program, week, weeks } from "./fixtures";

const ws = weeks();
const p = program(ws);
// صباح الأحد من الأسبوع الرابع: حان موعد مهام الافتتاحي حتى الثالث وتقاريرها، لا الرابع
const now = at(week(ws, 4).gregorian, 1);

test("المهام من المستحق حتى الآن لا من البرنامج كله", () => {
  const rows = participant();
  rows.submissions = [0, 1, 2, 3].map((n) => graded(`a${n}`, now));
  const d = progressFrom(rows, p, now);
  assert.equal(d.tasks.done, 4);
  assert.equal(d.tasks.due, 4);
  assert.equal(d.tasks.total, 13);
  assert.equal(tallyShort(d.tasks), "4/4");
});

test("ما سُلّم قبل موعده منجزٌ ومستحقٌّ معاً، فلا تتجاوز النسبة تمامها", () => {
  const rows = participant();
  rows.submissions = [0, 1, 2, 3, 4].map((n) => graded(`a${n}`, now));
  const d = progressFrom(rows, p, now);
  assert.equal(d.tasks.done, 5);
  assert.equal(d.tasks.due, 5);
});

test("المُرجَع إلى صاحبه لا يُعدّ منجزاً حتى يُعيده", () => {
  const rows = participant();
  rows.submissions = [0, 1].map((n) => graded(`a${n}`, now));
  rows.returns = [{ id: "r1", kind: "SUBMISSION", recordId: "s-a1", note: "عدّل", returnedAt: now, returnedBy: "المدير" }];
  const d = progressFrom(rows, p, now);
  assert.equal(d.tasks.done, 1);
  assert.equal(d.tasks.due, 4);
});

test("المنضمّ متأخراً لا يُطالَب بما فات موعده قبل انضمامه", () => {
  const rows = participant(at(week(ws, 2).gregorian, 0));
  const d = progressFrom(rows, p, now);
  // فات قبل انضمامه الافتتاحي والأول، فالمستحق الثاني والثالث وحدهما
  assert.equal(d.tasks.due, 2);
  assert.equal(d.tasks.total, 11);
  assert.equal(d.reports.due, 2);
});

test("التمديد المعتمد يؤخّر الموعد فلا تُستحقّ المهمة قبله", () => {
  const rows = participant();
  rows.extensions = new Map([["a3", at(week(ws, 4).gregorian, 3, 22)]]);
  const d = progressFrom(rows, p, now);
  assert.equal(d.tasks.due, 3);
});

test("أثناء الإيقاف يقف المستحق عند لحظة بدئه", () => {
  const pausedWs = weeks({ since: now.getTime(), reason: null, until: null, past: [] });
  const later = at(week(ws, 8).gregorian, 1);
  const frozen = progressFrom(participant(), program(pausedWs), later);
  const atPause = progressFrom(participant(), p, now);
  assert.equal(frozen.tasks.due, atPause.tasks.due);
  assert.equal(frozen.reports.due, atPause.reports.due);
});

test("الورد: الصفحات مقابل نصاب ما انقضى، والمعايشة: ساعات ما انقضى من أسابيعها", () => {
  const d = progressFrom(participant(), p, now);
  assert.equal(d.reading.due, 223);
  assert.equal(d.field.due, 1);
  assert.equal(d.field.total, 12);
});

test("المنجز قبل أن يُستحقّ شيءٌ يُقرأ «مبكراً» لا «من 0»", () => {
  assert.equal(tallyText({ done: 20, due: 0 }, "صفحة"), "20 صفحة مبكراً — لم يُستحقّ شيء بعد");
  assert.equal(tallyText({ done: 0, due: 0 }), "لم يُستحقّ بعد");
  assert.equal(tallyShort({ done: 20, due: 0 }), "20 مبكراً");
  assert.equal(tallyText({ done: 3, due: 5 }, "مستحقة"), "3 من 5 مستحقة");
});
