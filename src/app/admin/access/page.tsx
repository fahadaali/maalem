import { requireRole } from "@/lib/auth";
import { PageHeader, Card, Badge } from "@/components/ui";
import { ADMIN_ONLY, AREA, PUBLIC_PATHS, ROLE_AREA_LABELS } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/utils";

export const metadata = { title: "الصلاحيات" };

/**
 * من يصل إلى ماذا — مقروءاً من قواعد المنصة نفسها لا من جدول يُكتب بيد.
 *
 * جدولٌ يُحرَّر بيدٍ يكذب بعد أول تعديل في الشيفرة. وهذه الصفحة تعرض المصفوفة
 * من `roles.ts` الذي يقرؤه الوسيط والصفحات، فإن تغيّرت القاعدة تغيّر العرض معها.
 */
export default async function AccessPage() {
  await requireRole("ADMIN");

  return (
    <>
      <PageHeader
        title="الصلاحيات"
        subtitle="مناطق الأدوار والمسارات المحجوبة وما يُفتح بلا دخول — كما تقرؤها المنصة نفسها في كل طلب."
      />

      <Card title="مناطق الأدوار" className="mb-4">
        <p className="text-sm text-muted mb-3">
          لكل دور منطقة واحدة لا يتجاوزها. يحرسها الوسيط عند التنقّل، وتتحقّق منها كل صفحة بنفسها — فلا يكفي أحدهما.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>الدور</th><th>منطقته</th><th>ما دونها</th></tr></thead>
            <tbody>
              {(Object.entries(AREA) as [keyof typeof AREA, string][]).map(([role, base]) => (
                <tr key={role}>
                  <td className="font-medium">{ROLE_LABELS[role]}</td>
                  <td dir="ltr">{base}</td>
                  <td className="text-muted">{ROLE_AREA_LABELS[role]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="محجوب على مدير المشروع وحده" className="mb-4">
        <p className="text-sm text-muted mb-3">
          مسارات خارج منطقة الإدارة لا يدخلها غيره: خطة المشروع بمراحلها وسجل مخاطرها وميزانيتها ومصفوفة مهامه.
        </p>
        <ul className="text-sm space-y-1">
          {ADMIN_ONLY.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <Badge tone="ink">مدير المشروع</Badge>
              <span dir="ltr">{p}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="مفتوح بلا دخول" className="mb-4">
        <p className="text-sm text-muted mb-3">
          هذه وحدها تُفتح لمن لا حساب له، وما عداها — ومنه وثيقة البرنامج ومركز المساعدة — خلف الجلسة.
        </p>
        <ul className="text-sm space-y-1">
          {PUBLIC_PATHS.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <Badge tone="soft">عام</Badge>
              <span dir="ltr">{p}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="قواعد ثابتة في المنصة">
        <ul className="text-sm space-y-2 list-disc ps-5">
          <li>المشرف المرافق يرى من رُبطوا به وحدهم، ولا يصل إلى سجلات غيرهم ولا إلى الإدارة.</li>
          <li>المرفقات لا تُقدَّم إلا بجلسة: لصاحبها، ومشرفه، ومدير المشروع — وموادُّ المكتبة وبطاقات الأسابيع لكل من دخل.</li>
          <li>تصدير البيانات إلى ملفات الجداول لمدير المشروع وحده.</li>
          <li>معاينة تجربة المشارك تفتح واجهته بحساب المدير نفسه وللقراءة فقط، فلا تظهر فيها سجلات أي مشارك آخر.</li>
          <li>صفحات ما خلف الجلسة تُرسل بترويسة «لا تُفهرس»، ويمنعها ملف robots كذلك.</li>
        </ul>
      </Card>
    </>
  );
}
