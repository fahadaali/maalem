-- CreateTable
CREATE TABLE "HelpItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "href" TEXT,
    "hrefLabel" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "HelpItem_audience_order_idx" ON "HelpItem"("audience", "order");
