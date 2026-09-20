-- طابورُ التسليم: الإشعار يُدرج في الطلب، ويُسلَّم في الجدول.
--
-- كان `notifyUsers` يُشعر ويدفع ويُبرد في الطلب نفسه: تشعُّبٌ بـM+E+9 طلباً
-- فرعياً، و`Promise.all` يطلق M دفعةً واحدة أمام سقف **ست** وصلات متزامنة مهلةُ
-- كلٍّ منها عشر ثوانٍ — فالسابع فصاعداً تنفد مهلته وهو في الطابور قبل أن يتصل.
-- فصار الإدراج استعلاماً واحداً مهما كان العدد، والتسليمُ في `/api/cron/drain`
-- بميزانيته الخمسين المستقلة.
--
-- `deliveredAt` فارغةً تعني «في الطابور»، و`emailMode` تحمل نيّة المُشعِر إلى
-- المُسلِّم بعد أن كانت وسيطاً يضيع بانتهاء الطلب.

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "deliveredAt" DATETIME;
ALTER TABLE "Notification" ADD COLUMN "emailMode" TEXT NOT NULL DEFAULT 'fallback';

-- CreateIndex
CREATE INDEX "Notification_deliveredAt_idx" ON "Notification"("deliveredAt");

-- الصفوف القائمة أُرسلت في حينها. ولولا ختمُها مُسلَّمةً لأعاد أولُ تصريفٍ
-- إرسالَ تاريخ الإشعارات كلِّه إلى كل مستخدم.
UPDATE "Notification" SET "deliveredAt" = "createdAt" WHERE "deliveredAt" IS NULL;
