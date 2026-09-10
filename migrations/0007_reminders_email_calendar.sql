-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohortId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "sendAt" DATETIME NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'PARTICIPANTS',
    "userId" TEXT,
    "sentAt" DATETIME,
    "channels" TEXT NOT NULL DEFAULT 'PUSH',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reminder_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Reminder_sentAt_sendAt_idx" ON "Reminder"("sentAt", "sendAt");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailOptIn" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "calendarToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");
