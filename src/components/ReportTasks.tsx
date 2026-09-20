import { taskStatusLabel } from "@/lib/report";

type Entry = { id: string; title: string; status: string; note: string | null };

/**
 * رصد المهام كما يقرؤه المراجع — في مكوّن واحد تقرأ منه لوحة المدير ولوحة المرشد،
 * فلا تفترق الشاشتان كما افترقتا في قائمة حقول التقرير قبله.
 * وتقريرٌ سُلّم قبل تفصيل المهام لا رصد له، فيُعرض نصّه الحرّ كما كتبه صاحبه.
 */
export default function ReportTasks({ report }: { report: { tasks: Entry[]; taskProgress: string } }) {
  if (report.tasks.length === 0) {
    if (!report.taskProgress) return null;
    return (
      <div className="mb-3">
        <div className="text-xs text-muted">المهمة الأسبوعية</div>
        <div className="whitespace-pre-wrap text-sm">{report.taskProgress}</div>
      </div>
    );
  }
  return (
    <div className="mb-3">
      <div className="text-xs text-muted mb-1">مهام الأسبوع</div>
      <ul className="text-sm space-y-0.5">
        {report.tasks.map((t) => (
          <li key={t.id}>
            <span className="font-medium">{t.title}</span>
            {" — "}
            {taskStatusLabel(t.status)}
            {t.note ? <span className="text-muted"> · {t.note}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
