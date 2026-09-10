-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "circleScore" INTEGER;
ALTER TABLE "Attendance" ADD COLUMN "participation" INTEGER;

-- CreateTable
CREATE TABLE "MentorEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "regularity" INTEGER NOT NULL,
    "engagement" INTEGER NOT NULL,
    "application" INTEGER NOT NULL,
    "conduct" INTEGER NOT NULL,
    "growth" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MentorEvaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MentorEvaluation_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MentorEvaluation_userId_period_key" ON "MentorEvaluation"("userId", "period");

