import { Eye } from "lucide-react";
import { endPreview } from "@/app/admin/actions";

/** شريط ثابت يوضّح أن مدير المشروع في وضع معاينة للقراءة فقط */
export default function PreviewBanner() {
  return (
    <div className="sticky top-14 z-30 px-4 md:px-8 no-print">
      <div className="max-w-6xl mx-auto card card-muted border border-line-2 flex flex-wrap items-center gap-3 py-2">
        <Eye size={16} className="shrink-0" />
        <div className="flex-1 text-sm min-w-[12rem]">
          <span className="font-medium">وضع المعاينة</span>
          <span className="text-muted"> — هذه واجهة المشارك كما يراها، بحسابك أنت وللقراءة فقط. لا تظهر هنا سجلات أي مشارك آخر، ولا يُحفظ أي تغيير.</span>
        </div>
        <form action={endPreview}>
          <button className="btn btn-sm shrink-0">العودة إلى لوحة الإدارة</button>
        </form>
      </div>
    </div>
  );
}
