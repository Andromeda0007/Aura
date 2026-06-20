"use client";

import { format } from "date-fns";
import { ArrowLeft, Printer, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { sessionApi, type SessionReport } from "@/lib/api";

export function ReportView({ sessionId }: { sessionId: string }) {
  const ready = useRequireAuth();
  const [report, setReport] = useState<SessionReport | null>(null);

  useEffect(() => {
    if (!ready) return;
    sessionApi.report(sessionId).then(setReport).catch(() => toast.error("Could not load report"));
  }, [ready, sessionId]);

  if (!ready || !report) return null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="grid h-9 w-9 place-items-center rounded-full border border-border transition-colors hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-semibold">Class report</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / PDF
        </Button>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <p className="text-sm text-muted-foreground">
          {report.date ? format(new Date(report.date), "EEEE, MMMM d, yyyy") : ""}
          {report.durationMin ? ` · ${report.durationMin} min` : ""}
        </p>
        <h2 className="mt-1 font-display text-4xl font-semibold tracking-tight">{report.subject}</h2>

        <div className="mt-6 flex gap-3 text-sm">
          <Stat label="Aura asks" value={report.stats.commands} />
          <Stat label="Transcript lines" value={report.stats.transcripts} />
          <Stat label="Quizzes" value={report.quizzes.length} />
        </div>

        {report.summary && (
          <section className="mt-8">
            <h3 className="font-display text-lg font-semibold">Recap</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {report.summary}
            </p>
          </section>
        )}

        {report.keyPoints.length > 0 && (
          <section className="mt-8">
            <h3 className="font-display text-lg font-semibold">Key takeaways</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {report.keyPoints.map((k, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">•</span> {k}
                </li>
              ))}
            </ul>
          </section>
        )}

        {report.highlights.length > 0 && (
          <section className="mt-8">
            <h3 className="font-display text-lg font-semibold">Starred moments</h3>
            <ul className="mt-2 space-y-2">
              {report.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2.5 rounded-xl bg-muted px-3 py-2 text-sm">
                  <Star className="mt-0.5 h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {report.keyConcepts.length > 0 && (
          <section className="mt-8">
            <h3 className="font-display text-lg font-semibold">Concepts covered</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {report.keyConcepts.map((c, i) => (
                <span key={i} className="rounded-full bg-muted px-3 py-1 text-xs">
                  {c}
                </span>
              ))}
            </div>
          </section>
        )}

        {report.quizzes.length > 0 && (
          <section className="mt-8">
            <h3 className="font-display text-lg font-semibold">Quizzes</h3>
            <div className="mt-2 divide-y divide-border rounded-xl border border-border">
              {report.quizzes.map((q) => (
                <div key={q.shareCode} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-mono text-xs">{q.shareCode}</span>
                  <span className="text-muted-foreground">{q.questionCount} questions</span>
                  <span className="tabular-nums">{q.attempts} attempts</span>
                  <span className="tabular-nums font-medium">{q.avgPct}% avg</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {!report.summary && report.keyPoints.length === 0 && report.quizzes.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">
            Not much to recap yet — ask Aura for a summary during the session to fill this out.
          </p>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-2.5">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
