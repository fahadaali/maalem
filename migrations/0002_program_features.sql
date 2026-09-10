-- AlterTable
ALTER TABLE "User" ADD COLUMN "charterAcceptedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "charterName" TEXT;
ALTER TABLE "User" ADD COLUMN "surveyDoneAt" DATETIME;

-- CreateTable
CREATE TABLE "ProgramWeek" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Diagnostic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "scores" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Diagnostic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "author" TEXT,
    "description" TEXT,
    "url" TEXT,
    "competency" TEXT,
    "week" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SessionMinutes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "title" TEXT,
    "guestName" TEXT,
    "present" TEXT,
    "minutes" TEXT NOT NULL,
    "decisions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "week" INTEGER,
    "contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "backup" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BudgetEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item" TEXT NOT NULL,
    "basis" TEXT,
    "planned" REAL NOT NULL DEFAULT 0,
    "actual" REAL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "spentAt" DATETIME
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answers" TEXT NOT NULL,
    "liked" TEXT,
    "improve" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProgramReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "highlights" TEXT,
    "challenges" TEXT,
    "lessons" TEXT,
    "recommendations" TEXT,
    "snapshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "total" REAL NOT NULL,
    "note" TEXT,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgramWeek_number_key" ON "ProgramWeek"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Diagnostic_userId_stage_key" ON "Diagnostic"("userId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMinutes_week_type_key" ON "SessionMinutes"("week", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramReport_kind_period_key" ON "ProgramReport"("kind", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_userId_key" ON "Certificate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_serial_key" ON "Certificate"("serial");

