-- CreateTable
CREATE TABLE "FinalGrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "computed" REAL NOT NULL,
    "adjustment" REAL NOT NULL DEFAULT 0,
    "reason" TEXT,
    "breakdown" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinalGrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'COMPLETION',
    "userId" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "total" REAL NOT NULL,
    "note" TEXT,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Certificate" ("id", "issuedAt", "level", "note", "serial", "total", "userId") SELECT "id", "issuedAt", "level", "note", "serial", "total", "userId" FROM "Certificate";
DROP TABLE "Certificate";
ALTER TABLE "new_Certificate" RENAME TO "Certificate";
CREATE UNIQUE INDEX "Certificate_userId_key" ON "Certificate"("userId");
CREATE UNIQUE INDEX "Certificate_serial_key" ON "Certificate"("serial");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "FinalGrade_userId_key" ON "FinalGrade"("userId");

