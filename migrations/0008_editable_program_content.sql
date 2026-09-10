-- CreateTable
CREATE TABLE "ProgramBook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "pages" INTEGER NOT NULL DEFAULT 0,
    "weeks" TEXT NOT NULL,
    "circle" TEXT NOT NULL,
    "availability" TEXT NOT NULL,
    CONSTRAINT "ProgramBook_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProgramBook_cohortId_order_idx" ON "ProgramBook"("cohortId", "order");

-- CreateTable
CREATE TABLE "CharterItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    CONSTRAINT "CharterItem_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CharterItem_cohortId_order_idx" ON "CharterItem"("cohortId", "order");

-- CreateTable
CREATE TABLE "AssessmentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "tool" TEXT,
    "minimum" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    CONSTRAINT "AssessmentItem_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AssessmentItem_cohortId_kind_order_idx" ON "AssessmentItem"("cohortId", "kind", "order");

-- CreateTable
CREATE TABLE "CompletionLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "min" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "certificate" TEXT NOT NULL,
    CONSTRAINT "CompletionLevel_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CompletionLevel_cohortId_min_idx" ON "CompletionLevel"("cohortId", "min");

-- CreateTable
CREATE TABLE "CompetencyDef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "intro" TEXT NOT NULL,
    CONSTRAINT "CompetencyDef_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CompetencyDef_cohortId_order_idx" ON "CompetencyDef"("cohortId", "order");

-- CreateTable
CREATE TABLE "CompetencyItemRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencyId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "indicator" TEXT NOT NULL,
    "tasks" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "cost" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "refs" TEXT NOT NULL,
    CONSTRAINT "CompetencyItemRow_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "CompetencyDef" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CompetencyItemRow_competencyId_order_idx" ON "CompetencyItemRow"("competencyId", "order");
