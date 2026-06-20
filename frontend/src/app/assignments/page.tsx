"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ClipboardList, Copy, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { Aurora } from "@/components/ui/aurora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  assignmentApi,
  quizApi,
  type AssignmentSubmissions,
  type AssignmentSummary,
  type QuizSummary,
} from "@/lib/api";
import { cn } from "@/lib/utils";

function SubmissionsPanel({ id }: { id: string }) {
  const [data, setData] = useState<AssignmentSubmissions | null>(null);
  useEffect(() => {
    assignmentApi.submissions(id).then(setData).catch(() => {});
  }, [id]);
  if (!data) return <p className="px-4 pb-4 text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-4 px-4 pb-4">
      {data.submissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No submissions yet.</p>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {data.submissions.map((s, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="truncate">{s.name}</span>
              {data.hasQuiz && (
                <span className="tabular-nums font-medium">
                  {s.score}/{s.total}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {data.notSubmitted.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Not submitted ({data.notSubmitted.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.notSubmitted.map((n) => (
              <span key={n} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {n}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssignmentsPage() {
  const ready = useRequireAuth();
  const [items, setItems] = useState<AssignmentSummary[]>([]);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [quizId, setQuizId] = useState("");
  const [due, setDue] = useState("");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setItems(await assignmentApi.list());
  }

  useEffect(() => {
    if (!ready) return;
    refresh().catch(() => toast.error("Could not load assignments"));
    quizApi.list().then(setQuizzes).catch(() => {});
  }, [ready]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      await assignmentApi.create({
        title: title.trim(),
        instructions: instructions.trim(),
        quiz_id: quizId || null,
        due_at: due ? new Date(due).toISOString() : null,
      });
      setTitle("");
      setInstructions("");
      setQuizId("");
      setDue("");
      await refresh();
      toast.success("Assignment created");
    } catch {
      toast.error("Could not create assignment");
    } finally {
      setCreating(false);
    }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/a/${code}`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success("Link copied"),
      () => toast.error("Could not copy"),
    );
  }

  if (!ready) return null;

  return (
    <div className="relative flex flex-1 flex-col">
      <Aurora className="opacity-40" />
      <AppHeader />

      <main className="mx-auto grid w-full max-w-4xl flex-1 gap-8 px-6 py-10 lg:grid-cols-[1fr_20rem]">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Homework</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Assign a quiz or task; students complete it from a link.
          </p>

          <div className="mt-6 space-y-3">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-medium">No assignments yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Create one on the right.</p>
              </div>
            ) : (
              items.map((a) => {
                const isOpen = open === a.id;
                return (
                  <div key={a.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : a.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.hasQuiz ? "Quiz · " : ""}
                            {a.dueAt ? `due ${formatDistanceToNow(new Date(a.dueAt), { addSuffix: true })}` : "no due date"}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs tabular-nums">
                          {a.submissions} done
                        </span>
                        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                      </button>
                      <button
                        type="button"
                        aria-label="Copy link"
                        onClick={() => copyLink(a.shareCode)}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    {isOpen && <SubmissionsPanel id={a.id} />}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside>
          <h2 className="text-lg font-semibold">New assignment</h2>
          <form onSubmit={create} className="mt-3 space-y-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Instructions (optional)"
              className="min-h-20 w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <select
              aria-label="Attach a quiz"
              value={quizId}
              onChange={(e) => setQuizId(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">No quiz (task only)</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.subject} ({q.questionCount} Q)
                </option>
              ))}
            </select>
            <Input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              aria-label="Due date"
            />
            <Button type="submit" disabled={creating} className="w-full">
              <Plus className="h-4 w-4" /> {creating ? "Creating…" : "Create"}
            </Button>
          </form>
        </aside>
      </main>
    </div>
  );
}
