-- الإيقاف المؤقت للدفعة واستئنافها.
--
-- لم يكن للمدير على الدفعة إلا «الإغلاق»، فإن توقّف البرنامج لإجازةٍ أو ظرف
-- مضى الأسبوع الحالي بتاريخه، وتتابعت التذكيرات، وتراكم «متأخر» على المشاركين،
-- ونقل المدير مواعيد كل أسبوعٍ ومهمةٍ بيده.
--
-- أعمدةٌ على الدفعة لا جدولٌ مستقل: صفُّ الدفعة النشطة يُقرأ في كل طلب أصلاً
-- (`activeCohortId`)، فتُقرأ حالة الإيقاف معه بلا استعلامٍ زائد. والسجلّ نصٌّ
-- JSON بالإيقافات المنتهية وإزاحاتها، منه يُحسب التأخير بعد طرح مدد الإيقاف.

-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN "pausedAt" DATETIME;
ALTER TABLE "Cohort" ADD COLUMN "pauseReason" TEXT;
ALTER TABLE "Cohort" ADD COLUMN "pausedBy" TEXT;
ALTER TABLE "Cohort" ADD COLUMN "pauseUntil" TEXT;
ALTER TABLE "Cohort" ADD COLUMN "pauses" TEXT NOT NULL DEFAULT '[]';
