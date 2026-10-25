import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshotRows, type Snapshot } from "../src/lib/snapshot";

const base: Snapshot = {
  week: 4, participants: 5, attendanceAvg: 90, readingCards: 40, reportsSubmitted: 20, reportsExpected: 20,
  tasksSubmitted: 18, tasksGraded: 15, fieldHours: 6, quizAvg: 80, leadership: 1, projectsApproved: 0, charterSigned: 5,
};

test("اللقطة القديمة تُعرض بتسميتها الأولى لا «من المستحقة»", () => {
  const rows = snapshotRows({ ...base, reportsSubmitted: 25, gradeAvg: 30 });
  const reports = rows.find((r) => r.label.startsWith("التقارير"))!;
  assert.equal(reports.label, "التقارير المسلّمة / المتوقعة");
  assert.equal(reports.value, "25 / 20");
  assert.ok(rows.some((r) => r.label.includes("التراكمية") && r.value === "30"));
});

test("اللقطة الجديدة: المنجز من المستحق بنسبته", () => {
  const rows = snapshotRows({ ...base, tasksDue: 20, completionPct: 85, interimAvg: 88, gradeAvg: 30 });
  assert.equal(rows.find((r) => r.label === "المهام المسلّمة من المستحقة")!.value, "18 من 20 (90%)");
  assert.equal(rows.find((r) => r.label === "التقارير المسلّمة من المستحقة")!.value, "20 من 20 (100%)");
  assert.equal(rows.find((r) => r.label === "نسبة الإنجاز من المستحق")!.value, "85%");
});
