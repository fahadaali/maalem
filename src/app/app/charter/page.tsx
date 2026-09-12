import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Alert } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { acceptCharter } from "../actions";
import { PROGRAM } from "@/lib/program";
import { getCharter } from "@/lib/content";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "ميثاق المشاركة" };

export default async function CharterPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireParticipantView();
  const { ok, err } = await searchParams;
  const me = await db.user.findUnique({ where: { id: user.id }, select: { charterAcceptedAt: true, charterName: true } });
  const signed = !!me?.charterAcceptedAt;

  return (
    <>
      <PageHeader title="ميثاق المشاركة" subtitle={`${PROGRAM.name} — ${PROGRAM.cohort}`} />
      <FormMessage ok={ok} err={err} />
      {signed && (
        <Alert tone="success">
          وقّعت الميثاق باسم «{me?.charterName}» بتاريخ {formatDateTime(me!.charterAcceptedAt!)}.
        </Alert>
      )}
      <Card>
        <p className="text-sm text-muted mb-4">
          بتوقيعي على هذا الميثاق ألتزم بما يلي طوال مدة البرنامج، وأعلم أن التزامي به شرط لمنح وثيقة الإتمام:
        </p>
        <form action={acceptCharter}>
          <ol className="space-y-3 mb-5">
            {(await getCharter()).map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  id={`item_${i}`}
                  name={`item_${i}`}
                  className="accent-black mt-1 shrink-0"
                  required
                  disabled={signed}
                  defaultChecked={signed}
                />
                <label htmlFor={`item_${i}`}>{item}</label>
              </li>
            ))}
          </ol>
          <div className="field">
            <label className="label">التوقيع: اكتب اسمك الثلاثي</label>
            <input name="name" className="input" required minLength={4} defaultValue={me?.charterName ?? user.name} disabled={signed} />
          </div>
          {!signed && <SubmitButton>أقرّ وألتزم بالميثاق</SubmitButton>}
        </form>
      </Card>
    </>
  );
}
