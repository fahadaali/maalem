-- إرجاعُ الإدخال إلى صاحبه، ومراجعةُ بطاقات القراءة وخطط التعلم.
--
-- كان مدير المشروع لا يملك على إدخال المشارك إلا التراجعَ عنه، وهو حذفٌ بلقطة
-- يضيع معه النصُّ الذي كتبه صاحبه. فصار له «إرجاعٌ للتعديل»: يبقى السجل كما هو
-- ويُفتح لصاحبه، ويُحسب تأخّره بموعده الأصلي، ولا يدخل في الدرجة حتى يُعاد.
--
-- جدولٌ واحد لكل الأنواع، على نمط سجل التراجع، لا عمودان على كل جدول: الأعمدة
-- كانت تبلغ عشرين عبارةً فتتجاوز ما يُطبَّق وقت الإقلاع، ولا تحفظ تاريخ الإرجاع.
-- وأختامُ المراجعة على السجل لا تُمسّ عند الإرجاع — صفُّ الإرجاع المفتوح هو
-- الحَكَم — فلا يتعارض الإرجاعُ مع طوابير المراجعة ولا مع التراجع والإعادة.
--
-- وبطاقة القراءة وخطة التعلم بلا موضع للمراجعة أصلاً، فيُضاف لهما ما للتقرير
-- الأسبوعي: ملاحظةٌ وختمُ مراجعة، بلا درجة.

-- CreateTable
CREATE TABLE "ItemReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "returnedBy" TEXT NOT NULL,
    "returnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolution" TEXT,
    CONSTRAINT "ItemReturn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ItemReturn_userId_resolvedAt_idx" ON "ItemReturn"("userId", "resolvedAt");

-- CreateIndex
CREATE INDEX "ItemReturn_kind_recordId_idx" ON "ItemReturn"("kind", "recordId");

-- AlterTable
ALTER TABLE "ReadingCard" ADD COLUMN "feedback" TEXT;
ALTER TABLE "ReadingCard" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "LearningPlan" ADD COLUMN "feedback" TEXT;
ALTER TABLE "LearningPlan" ADD COLUMN "reviewedAt" DATETIME;
