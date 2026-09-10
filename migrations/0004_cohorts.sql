-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "week" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "competency" TEXT,
    "dueAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assignment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("competency", "createdAt", "description", "dueAt", "id", "title", "week") SELECT "competency", "createdAt", "description", "dueAt", "id", "title", "week" FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE TABLE "new_BudgetEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "item" TEXT NOT NULL,
    "basis" TEXT,
    "planned" REAL NOT NULL DEFAULT 0,
    "actual" REAL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "spentAt" DATETIME,
    CONSTRAINT "BudgetEntry_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BudgetEntry" ("actual", "basis", "id", "item", "note", "optional", "order", "planned", "spentAt") SELECT "actual", "basis", "id", "item", "note", "optional", "order", "planned", "spentAt" FROM "BudgetEntry";
DROP TABLE "BudgetEntry";
ALTER TABLE "new_BudgetEntry" RENAME TO "BudgetEntry";
CREATE TABLE "new_Guest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "name" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "week" INTEGER,
    "contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "backup" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Guest_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Guest" ("backup", "contact", "createdAt", "id", "name", "notes", "status", "topic", "week") SELECT "backup", "contact", "createdAt", "id", "name", "notes", "status", "topic", "week" FROM "Guest";
DROP TABLE "Guest";
ALTER TABLE "new_Guest" RENAME TO "Guest";
CREATE TABLE "new_ProgramReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "kind" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "highlights" TEXT,
    "challenges" TEXT,
    "lessons" TEXT,
    "recommendations" TEXT,
    "snapshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProgramReport_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProgramReport" ("challenges", "createdAt", "highlights", "id", "kind", "lessons", "period", "recommendations", "snapshot", "summary", "updatedAt") SELECT "challenges", "createdAt", "highlights", "id", "kind", "lessons", "period", "recommendations", "snapshot", "summary", "updatedAt" FROM "ProgramReport";
DROP TABLE "ProgramReport";
ALTER TABLE "new_ProgramReport" RENAME TO "ProgramReport";
CREATE UNIQUE INDEX "ProgramReport_cohortId_kind_period_key" ON "ProgramReport"("cohortId", "kind", "period");
CREATE TABLE "new_ProgramWeek" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "hijri" TEXT NOT NULL,
    "gregorian" TEXT NOT NULL,
    "competency" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "circle" TEXT NOT NULL,
    "reading" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "meetingPlace" TEXT,
    "remoteUrl" TEXT,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProgramWeek_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProgramWeek" ("circle", "competency", "gregorian", "hijri", "id", "label", "meetingPlace", "note", "number", "reading", "remoteUrl", "session", "task", "updatedAt") SELECT "circle", "competency", "gregorian", "hijri", "id", "label", "meetingPlace", "note", "number", "reading", "remoteUrl", "session", "task", "updatedAt" FROM "ProgramWeek";
DROP TABLE "ProgramWeek";
ALTER TABLE "new_ProgramWeek" RENAME TO "ProgramWeek";
CREATE UNIQUE INDEX "ProgramWeek_cohortId_number_key" ON "ProgramWeek"("cohortId", "number");
CREATE TABLE "new_Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'FIQH',
    "week" INTEGER,
    "passMark" INTEGER NOT NULL DEFAULT 70,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quiz_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Quiz" ("createdAt", "id", "kind", "passMark", "published", "title", "week") SELECT "createdAt", "id", "kind", "passMark", "published", "title", "week" FROM "Quiz";
DROP TABLE "Quiz";
ALTER TABLE "new_Quiz" RENAME TO "Quiz";
CREATE TABLE "new_SessionMinutes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "week" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "title" TEXT,
    "guestName" TEXT,
    "present" TEXT,
    "minutes" TEXT NOT NULL,
    "decisions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SessionMinutes_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SessionMinutes" ("createdAt", "date", "decisions", "guestName", "id", "minutes", "present", "title", "type", "updatedAt", "week") SELECT "createdAt", "date", "decisions", "guestName", "id", "minutes", "present", "title", "type", "updatedAt", "week" FROM "SessionMinutes";
DROP TABLE "SessionMinutes";
ALTER TABLE "new_SessionMinutes" RENAME TO "SessionMinutes";
CREATE UNIQUE INDEX "SessionMinutes_cohortId_week_type_key" ON "SessionMinutes"("cohortId", "week", "type");
CREATE TABLE "new_SurveyResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "answers" TEXT NOT NULL,
    "liked" TEXT,
    "improve" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SurveyResponse_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SurveyResponse" ("answers", "createdAt", "id", "improve", "liked") SELECT "answers", "createdAt", "id", "improve", "liked" FROM "SurveyResponse";
DROP TABLE "SurveyResponse";
ALTER TABLE "new_SurveyResponse" RENAME TO "SurveyResponse";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PARTICIPANT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "cohortId" TEXT,
    "charterAcceptedAt" DATETIME,
    "charterName" TEXT,
    "surveyDoneAt" DATETIME,
    "portfolioSubmittedAt" DATETIME,
    "mentorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("active", "charterAcceptedAt", "charterName", "createdAt", "email", "id", "mentorId", "name", "passwordHash", "phone", "portfolioSubmittedAt", "role", "surveyDoneAt", "username") SELECT "active", "charterAcceptedAt", "charterName", "createdAt", "email", "id", "mentorId", "name", "passwordHash", "phone", "portfolioSubmittedAt", "role", "surveyDoneAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_name_key" ON "Cohort"("name");

