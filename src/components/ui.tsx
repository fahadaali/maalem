import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="text-xs text-muted mb-1">{eyebrow}</div>}
        <h1 className="text-2xl md:text-3xl">{title}</h1>
        {subtitle && <div className="text-muted text-sm mt-1 max-w-2xl">{subtitle}</div>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn("card", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {title && <h2 className="text-lg">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "default", className }: { children: ReactNode; tone?: "default" | "ink" | "soft"; className?: string }) {
  return <span className={cn("badge", tone === "ink" && "badge-ink", tone === "soft" && "badge-soft", className)}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card card-muted text-center text-muted text-sm py-8">{children}</div>;
}

export function Progress({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      {label && (
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div className="progress">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: string; href?: string }) {
  const body = (
    <div className="card h-full">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-bold mt-1 display">{value}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-80">{body}</Link> : body;
}

export function DefinitionList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map((r) => (
        <div key={r.label} className="py-3 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-1 md:gap-4">
          <dt className="text-sm font-medium text-ink-2">{r.label}</dt>
          <dd className="text-sm">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "error" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl px-4 py-3 text-sm border mb-4",
        tone === "error" ? "border-ink bg-paper-3" : tone === "success" ? "border-ink bg-paper" : "border-line bg-paper-2",
      )}
    >
      {children}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm text-muted hover:text-ink inline-flex items-center gap-1 mb-3">
      ← {children}
    </Link>
  );
}
