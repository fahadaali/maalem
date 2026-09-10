import { PROGRAM } from "@/lib/program";
import { formatGregorian, formatHijri } from "@/lib/dates";

/** وثيقة الإتمام كما تُطبع */
export default function CertificateSheet({ name, level, total, serial, issuedAt, note, kind = "COMPLETION" }: { name: string; level: string; total: number; serial: string; issuedAt: Date; note?: string | null; kind?: string }) {
  const isCompletion = kind === "COMPLETION";
  return (
    <div className="border-4 border-ink rounded-2xl p-10 text-center max-w-3xl mx-auto bg-paper">
      <div className="text-sm text-muted">بسم الله الرحمن الرحيم</div>
      <h1 className="text-4xl mt-6 mb-1">{isCompletion ? "وثيقة إتمام" : "إفادة حضور"}</h1>
      <p className="text-muted text-sm mb-8">{PROGRAM.name} — {PROGRAM.subtitle}</p>
      <p className="text-base">تشهد إدارة البرنامج بأن</p>
      <p className="text-3xl display font-bold my-4">{name}</p>
      <p className="text-base leading-8">
        {isCompletion ? "قد أتمّ متطلبات برنامج" : "قد التحق ببرنامج"} «{PROGRAM.name}» لتأهيل المشرفين التربويين الجدد،
        <br />
        {PROGRAM.cohort}، بمجموع <span className="font-bold">{total}</span> من 100، وبتقدير <span className="font-bold">{level}</span>.
        {!isCompletion && <><br /><span className="text-sm text-muted">وله إعادة البرنامج في الدفعة التالية.</span></>}
      </p>
      {note && <p className="text-sm text-muted mt-4">{note}</p>}
      <div className="flex justify-between items-end mt-12 text-sm">
        <div className="text-start">
          <div className="text-muted text-xs">رقم الوثيقة</div>
          <div dir="ltr">{serial}</div>
        </div>
        <div className="text-end">
          <div className="text-muted text-xs">تاريخ الإصدار</div>
          <div>{formatHijri(issuedAt)}</div>
          <div className="text-muted text-xs">{formatGregorian(issuedAt)}</div>
        </div>
      </div>
      <div className="mt-10 pt-6 border-t border-line text-sm">
        <div className="text-muted text-xs mb-6">مدير المشروع</div>
        <div className="border-t border-line-2 w-48 mx-auto" />
      </div>
    </div>
  );
}
