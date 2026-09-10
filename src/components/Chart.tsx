"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export type Point = { label: string; value: number; note?: string; emphasis?: boolean };

function fmt(value: number, unit?: string) {
  const n = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return unit ? `${n}${unit}` : n;
}

/** أعمدة لسلسلة واحدة: القيمة على الرأس عند الطرف والقيمة القصوى فقط، والبقية في التلميح والجدول. */
export function ColumnChart({
  data,
  max,
  unit = "%",
  target,
  targetLabel,
  height = 168,
  caption,
}: {
  data: Point[];
  max?: number;
  unit?: string;
  target?: number;
  targetLabel?: string;
  height?: number;
  caption?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();
  const [showTable, setShowTable] = useState(false);

  const values = data.map((d) => d.value);
  const ceiling = max ?? Math.max(1, ...values);
  const top = values.length ? Math.max(...values) : 0;
  const topIndex = values.indexOf(top);
  const ticks = [0, ceiling / 2, ceiling];

  if (!data.length) return <div className="text-sm text-muted py-6 text-center">لا بيانات كافية بعد.</div>;

  return (
    <figure className="m-0">
      <div className="relative" style={{ height, paddingTop: 18 }}>
        {/* خطوط الشبكة */}
        <div className="absolute inset-x-0" style={{ top: 18, bottom: 0 }} aria-hidden>
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 border-t border-line"
              style={{ bottom: `${(t / ceiling) * 100}%` }}
            >
              <span className="absolute -top-2 start-0 text-[10px] text-muted bg-paper pe-1 tabular-nums">{fmt(t, unit)}</span>
            </div>
          ))}
          {target != null && target < ceiling && (
            <div
              className="absolute inset-x-0 border-t border-dashed border-ink-2"
              style={{ bottom: `${(target / ceiling) * 100}%` }}
            >
              <span className="absolute -top-4 end-0 text-[10px] text-ink-2 bg-paper px-1">{targetLabel ?? `المستهدف ${fmt(target, unit)}`}</span>
            </div>
          )}
        </div>

        {/* الأعمدة */}
        <div className="relative flex items-end gap-[2px] h-full" style={{ paddingTop: 0 }}>
          {data.map((d, i) => {
            const pct = ceiling > 0 ? Math.max(0, Math.min(100, (d.value / ceiling) * 100)) : 0;
            return (
              <button
                key={d.label + i}
                type="button"
                className="group relative flex-1 h-full flex items-end justify-center focus:outline-none"
                style={{ minWidth: 8 }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${d.label}: ${fmt(d.value, unit)}${d.note ? ` — ${d.note}` : ""}`}
              >
                <span
                  className={cn(
                    "block w-full transition-opacity",
                    active !== null && active !== i ? "opacity-45" : "opacity-100",
                  )}
                  style={{
                    height: `${pct}%`,
                    minHeight: d.value > 0 ? 2 : 0,
                    maxWidth: 24,
                    margin: "0 auto",
                    background: "var(--ink)",
                    borderRadius: "4px 4px 0 0",
                  }}
                />
                {i === topIndex && top > 0 && (
                  <span className="absolute -top-[18px] text-[11px] text-ink-2 tabular-nums whitespace-nowrap">{fmt(top, unit)}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* محور التسميات */}
      <div className="flex gap-[2px] mt-1 border-t border-line-2 pt-1">
        {data.map((d, i) => (
          <div
            key={d.label + i}
            className={cn(
              "flex-1 text-center text-[10px] truncate",
              d.emphasis ? "text-ink font-semibold" : "text-muted",
            )}
            style={{ minWidth: 8 }}
          >
            {d.label}
          </div>
        ))}
      </div>

      {/* التلميح */}
      <div className="mt-2 min-h-[2.4rem] text-xs" aria-live="polite">
        {active !== null ? (
          <div className="card card-muted !py-2 !px-3 inline-block">
            <span className="font-semibold">{data[active].label}</span>
            <span className="mx-2 tabular-nums">{fmt(data[active].value, unit)}</span>
            {data[active].note && <span className="text-muted">{data[active].note}</span>}
          </div>
        ) : (
          <span className="text-muted">{caption}</span>
        )}
      </div>

      <button type="button" className="btn btn-ghost btn-sm !px-0" aria-expanded={showTable} aria-controls={tableId} onClick={() => setShowTable((v) => !v)}>
        {showTable ? "إخفاء الجدول" : "عرض القيم كجدول"}
      </button>
      {showTable && (
        <div id={tableId} className="table-wrap mt-2">
          <table className="table">
            <thead><tr><th>البند</th><th>القيمة</th><th>ملحوظة</th></tr></thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.label + i}><td>{d.label}</td><td className="tabular-nums">{fmt(d.value, unit)}</td><td className="text-muted">{d.note ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

/** أشرطة أفقية لمقارنة الأفراد أو البنود، مرتّبة تنازلياً. */
export function BarList({ data, unit = "%", max, limit }: { data: Point[]; unit?: string; max?: number; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (!data.length) return <div className="text-sm text-muted py-6 text-center">لا بيانات كافية بعد.</div>;
  const ceiling = max ?? Math.max(1, ...data.map((d) => d.value));
  const shown = limit && !expanded ? data.slice(0, limit) : data;
  return (
    <div>
      <ul className="space-y-2 m-0 p-0 list-none">
        {shown.map((d, i) => (
          <li key={d.label + i}>
            <div className="flex justify-between text-xs mb-1 gap-2">
              <span className="truncate">{d.label}</span>
              <span className="text-ink-2 tabular-nums shrink-0">{fmt(d.value, unit)}{d.note ? <span className="text-muted"> · {d.note}</span> : null}</span>
            </div>
            <div className="h-[10px] bg-paper-3 rounded-[4px] overflow-hidden">
              <span className="block h-full bg-ink rounded-[4px]" style={{ width: `${ceiling > 0 ? Math.min(100, (d.value / ceiling) * 100) : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {limit && data.length > limit && (
        <button type="button" className="btn btn-ghost btn-sm !px-0 mt-2" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "طيّ القائمة" : `عرض الكل (${data.length})`}
        </button>
      )}
    </div>
  );
}
