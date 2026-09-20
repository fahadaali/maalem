-- CreateTable
CREATE TABLE "WeekTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "week" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    CONSTRAINT "WeekTask_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyReportTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "WeeklyReportTask_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WeeklyReportTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WeekTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WeekTask_cohortId_week_order_idx" ON "WeekTask"("cohortId", "week", "order");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReportTask_reportId_taskId_key" ON "WeeklyReportTask"("reportId", "taskId");
