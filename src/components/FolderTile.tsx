import { Folder } from "lucide-react";

/**
 * وجه المجلد في المكتبة: اسمٌ وعددٌ ولون، ولا شيء من محتواه.
 *
 * كانت مواد كل مجلد مبسوطةً تحت اسمه، فالصفحة طولٌ لا آخر له ولا يُعرف أين
 * ينتهي مجلدٌ ويبدأ غيره. والمجلد وعاءٌ يُفتح: يُرى مغلقاً فيُعلم ما فيه عدداً،
 * ولا يُرى ما فيه إلا بفتحه — كما في أقراص الملفات.
 */
export default function FolderTile({ name, color, count, note }: {
  name: string;
  color: string;
  count: number;
  note?: string | null;
}) {
  return (
    <div className="card p-3 flex items-center gap-3 h-full">
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 14%, var(--paper-2))` }}
      >
        <Folder size={19} strokeWidth={1.75} style={{ color }} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate leading-snug">{name}</div>
        <div className="text-xs text-muted">{count} مادة</div>
        {note && <div className="text-xs text-muted truncate mt-0.5">{note}</div>}
      </div>
    </div>
  );
}
