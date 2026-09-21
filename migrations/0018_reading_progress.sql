-- موضعُ القراءة في الحساب لا في الجهاز.
--
-- كان العارض لا يتذكّر شيئاً: الصفحةُ والتكبيرُ يبدآن من الصفر في كل فتحة، ولا
-- وثوبَ إلى صفحةٍ أصلاً. فمن قرأ ثمانين صفحةً من كتابٍ ثم أغلق، يعود فيمرّر
-- ثمانين مرةً ليجد موضعه — وإن فتحه من جهازٍ آخر فلا أثر.
--
-- `attachmentId` بلا مفتاحٍ أجنبيّ، كـ`Attachment.refId` نفسه: إنفاذُ المفاتيح
-- الأجنبية على D1 ليس مضموناً، فالتنظيفُ صريحٌ في مسار حذف الملف.

-- CreateTable
CREATE TABLE "ReadingProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "pages" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReadingProgress_userId_attachmentId_key" ON "ReadingProgress"("userId", "attachmentId");

-- CreateIndex
CREATE INDEX "ReadingProgress_userId_updatedAt_idx" ON "ReadingProgress"("userId", "updatedAt");
