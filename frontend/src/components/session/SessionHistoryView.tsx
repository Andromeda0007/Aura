"use client";

import { FileText, History, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ResponseView } from "@/components/ai-panel/ResponseView";
import { AppHeader } from "@/components/layout/AppHeader";
import { Breadcrumbs, batchTitle, type Crumb } from "@/components/layout/Breadcrumbs";
import { Aurora } from "@/components/ui/aurora";
import { batchApi, courseApi, semesterApi, sessionApi, unitApi } from "@/lib/api";
import type { AIResponse } from "@/types";

const SECTIONS: { type: string; label: string }[] = [
  { type: "quiz", label: "Quizzes" },
  { type: "summary", label: "Summaries" },
  { type: "explanation", label: "Explanations" },
  { type: "example", label: "Examples & numericals" },
  { type: "diagram", label: "Diagrams" },
  { type: "answer", label: "Answers" },
  { type: "format_board", label: "Cleaned boards" },
];

interface Artifact extends AIResponse {
  commandId: string;
}

export function SessionHistoryView({ sessionId }: { sessionId: string }) {
  const [subject, setSubject] = useState("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ label: "Batches", href: "/dashboard" }]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sessionApi
      .get(sessionId)
      .then(async (s) => {
        setSubject(s.subject);
        // best-effort breadcrumb up the hierarchy
        if (s.unit_id) {
          try {
            const u = await unitApi.get(s.unit_id);
            const c = await courseApi.get(u.unit.course_id);
            const sem = await semesterApi.get(c.course.semester_id);
            const dept = sem.department;
            const b = dept ? await batchApi.get(dept.batch_id) : null;
            setCrumbs([
              { label: "Batches", href: "/dashboard" },
              ...(b ? [{ label: batchTitle(b), href: `/batch/${b.id}` }] : []),
              ...(dept ? [{ label: dept.name, href: `/department/${dept.id}` }] : []),
              { label: `Sem ${sem.semester.number}`, href: `/semester/${sem.semester.id}` },
              { label: c.course.name, href: `/course/${c.course.id}` },
              { label: u.unit.name, href: `/unit/${u.unit.id}` },
              { label: s.subject },
            ]);
          } catch {
            setCrumbs([{ label: "Batches", href: "/dashboard" }, { label: s.subject }]);
          }
        }
      })
      .catch(() => toast.error("Session not found"));

    sessionApi
      .history(sessionId)
      .then((h) => {
        setArtifacts(
          h.commands.map((c) => ({
            type: c.type as AIResponse["type"],
            data: c.data,
            command: c.command,
            commandId: c.commandId,
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  const grouped = SECTIONS.map((s) => ({
    ...s,
    items: artifacts.filter((a) => a.type === s.type),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="relative flex flex-1 flex-col">
      <Aurora className="opacity-40" />
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <Breadcrumbs items={crumbs} />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{subject || "Session"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {artifacts.length} item{artifacts.length === 1 ? "" : "s"} generated
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/replay/${sessionId}`}
              className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm transition-colors hover:bg-muted"
            >
              <History className="h-4 w-4" /> Replay
            </Link>
            <Link
              href={`/report/${sessionId}`}
              className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm transition-colors hover:bg-muted"
            >
              <FileText className="h-4 w-4" /> Report
            </Link>
            <Link
              href={`/classroom/${sessionId}`}
              className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98]"
            >
              <Play className="h-4 w-4" /> Open live
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : grouped.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="font-medium">Nothing generated yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Open the live session and ask Aura for a quiz, summary, or diagram.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {grouped.map((section) => (
              <section key={section.type}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.label} · {section.items.length}
                </h2>
                <div className="space-y-3">
                  {section.items.map((a) => (
                    <div key={a.commandId} className="rounded-2xl border border-border bg-card p-4">
                      {a.command && (
                        <p className="mb-2 text-xs text-muted-foreground">
                          Asked: <span className="text-foreground">{a.command}</span>
                        </p>
                      )}
                      <ResponseView response={a} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
