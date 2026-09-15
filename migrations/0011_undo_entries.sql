-- CreateTable
CREATE TABLE "UndoEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "payload" TEXT NOT NULL,
    "at" DATETIME NOT NULL,
    "undoneBy" TEXT NOT NULL,
    "undoneAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredAt" DATETIME
);

-- CreateIndex
CREATE INDEX "UndoEntry_undoneAt_idx" ON "UndoEntry"("undoneAt");
