import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFrom } from "../src/lib/grades";
import { at, config, graded, participant, program, week, weeks } from "./fixtures";

const ws = weeks();
const p = program(ws);
const midway = at(week(ws, 4).gregorian, 1);
const end = at(week(ws, 14).gregorian, 10);

test("الدرجة المرحلية تقيس المهام بالمستحق، والتراكمية بالبرنامج كله", () => {
  const rows = participant();
  rows.submissions = [0, 1, 2, 3].map((n) => graded(`a${n}`, midway));
  const g = computeFrom(rows, config(p, midway));
  assert.equal(g.interim.parts.tasks, 20);
  assert.equal(g.tasks, 6.2);
});

test("ما ينتظر التقييم لا يُحسب على صاحبه في الدرجة المرحلية", () => {
  const rows = participant();
  rows.submissions = [0, 1, 2, 3].map((n) => graded(`a${n}`, midway));
  rows.submissions[3] = { ...rows.submissions[3], gradedAt: null, completeness: null, referencing: null, application: null, punctuality: null };
  const g = computeFrom(rows, config(p, midway));
  assert.equal(g.interim.parts.tasks, 20);
  assert.equal(g.due.tasks.pending, 1);
});

test("ساعات المعايشة التي تنتظر الاعتماد تخرج من المقام المرحلي", () => {
  const rows = participant();
  rows.fieldLogs = [{ id: "f1", date: midway, hours: 1, approvedAt: null, approvedBy: null, createdAt: midway, mentorName: "م", note: "ن" }];
  const g = computeFrom(rows, config(p, midway));
  assert.equal(g.interim.parts.field, null);
});

test("مكوّنٌ لم يُستحقّ منه شيءٌ خارج مقام الدرجة المرحلية", () => {
  const g = computeFrom(participant(), config(p, midway));
  assert.equal(g.interim.parts.leadership, null);
  assert.equal(g.interim.parts.project, null);
});

test("في ختام البرنامج تساوي المرحليةُ التراكميةَ في المهام لمن أتمّها", () => {
  const rows = participant();
  rows.submissions = p.assignments.map((a) => graded(a.id, a.dueAt));
  const g = computeFrom(rows, config(p, end));
  assert.equal(g.tasks, 20);
  assert.equal(g.interim.parts.tasks, 20);
});

test("المنضمّ متأخراً: الدرجة النهائية لا تحسب عليه ما انقضى قبل انضمامه", () => {
  const rows = participant(at(week(ws, 4).gregorian, 0));
  const owed = p.assignments.filter((a) => a.dueAt >= rows.user.createdAt);
  rows.submissions = owed.map((a) => graded(a.id, a.dueAt));
  const g = computeFrom(rows, config(p, end));
  assert.equal(owed.length, 9);
  assert.equal(g.stats.assignments, 9);
  assert.equal(g.tasks, 20);
  assert.equal(g.stats.readingRequired, 491);
  assert.equal(g.due.field.total, 11);
});

test("من انضمّ قبل البداية فمقامه البرنامج كله كما كان", () => {
  const g = computeFrom(participant(), config(p, end));
  assert.equal(g.stats.assignments, 13);
  assert.equal(g.stats.readingRequired, 714);
  assert.equal(g.due.field.total, 12);
});
