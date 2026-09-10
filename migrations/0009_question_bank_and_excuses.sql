-- AlterTable
ALTER TABLE "Question" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'MCQ';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "answers" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "explanation" TEXT;

-- CreateTable
CREATE TABLE "BankQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'MCQ',
    "text" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "answers" TEXT,
    "explanation" TEXT,
    "topic" TEXT NOT NULL DEFAULT 'FIQH',
    "week" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankQuestion_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BankQuestion_cohortId_topic_idx" ON "BankQuestion"("cohortId", "topic");

-- CreateTable
CREATE TABLE "ExcuseRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "week" INTEGER,
    "assignmentId" TEXT,
    "reason" TEXT NOT NULL,
    "untilAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decision" TEXT,
    "decidedBy" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExcuseRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExcuseRequest_status_createdAt_idx" ON "ExcuseRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ExcuseRequest_userId_createdAt_idx" ON "ExcuseRequest"("userId", "createdAt");
