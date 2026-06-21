"use client";

import { formatDistanceToNow } from "date-fns";
import { History, Pencil, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { Breadcrumbs, batchTitle, type Crumb } from "@/components/layout/Breadcrumbs";
import { LevelStatsPanel } from "@/components/stats/LevelStatsPanel";
import { AppBackdrop } from "@/components/ui/app-backdrop";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useCanWrite } from "@/hooks/useRole";
import { batchApi, courseApi, semesterApi, sessionApi, unitApi, type UnitDetail } from "@/lib/api";
import { LANGUAGES } from "@/lib/languages";
import type { Session } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/15 text-success",
  paused: "bg-accent/15 text-accent",
  completed: "bg-muted text-muted-foreground",
};

function detail(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof msg === "string" ? msg : fallback;
}

export function UnitView({ unitId }: { unitId: string }) {
  const ready = useRequireAuth();
  const canWrite = useCanWrite();
  const router = useRouter();
  const [data, setData] = useState<UnitDetail | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ label: "Batches", href: "/dashboard" }]);
  const [subject, setSubject] = useState("");
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<Session | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editLanguage, setEditLanguage] = useState(LANGUAGES[0].label);
  const [deleting, setDeleting] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function refresh() {
    const d = await unitApi.get(unitId);
    setData(d);
    return d;
  }

  useEffect(() => {
    if (!ready) return;
    refresh()
      .then(async (d) => {
        try {
          const c = await courseApi.get(d.unit.course_id);
          const sem = await semesterApi.get(c.course.semester_id);
          const dept = sem.department;
          const b = dept ? await batchApi.get(dept.batch_id) : null;
          setCrumbs([
            { label: "Batches", href: "/dashboard" },
            ...(b ? [{ label: batchTitle(b), href: `/batch/${b.id}` }] : []),
            ...(dept ? [{ label: dept.name, href: `/department/${dept.id}` }] : []),
            { label: `Semester ${sem.semester.number}`, href: `/semester/${sem.semester.id}` },
            { label: c.course.name, href: `/course/${c.course.id}` },
            { label: d.unit.name },
          ]);
        } catch {
          setCrumbs([{ label: "Batches", href: "/dashboard" }, { label: d.unit.name }]);
        }
      })
      .catch(() => toast.error("Unit not found"));
  }, [ready, unitId]);

  function openEdit(s: Session) {
    setEditing(s);
    setEditSubject(s.subject);
    setEditLanguage(s.language || LANGUAGES[0].label);
    setErr("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editSubject.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await sessionApi.update(editing.id, { subject: editSubject.trim(), language: editLanguage });
      setEditing(null);
      await refresh();
      toast.success("Saved");
    } catch (e2) {
      setErr(detail(e2, "Could not save"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await sessionApi.remove(deleting.id);
      setDeleting(null);
      await refresh();
      toast.success("Session deleted");
    } catch (e2) {
      toast.error(detail(e2, "Could not delete"));
    } finally {
      setBusy(false);
    }
  }

  async function startSession(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    setCreating(true);
    try {
      const s = await sessionApi.create(subject.trim(), unitId);
      router.push(`/classroom/${s.id}`);
    } catch {
      toast.error("Could not start session");
      setCreating(false);
    }
  }

  if (!ready || !data) return null;
  const { unit, sessions } = data;

  return (
    <div className="relative flex flex-1 flex-col">
      <AppBackdrop />
      <AppHeader />

      <main className="mx-auto w-full flex-1 px-6 py-8 lg:px-[10%]">
        <Breadcrumbs items={crumbs} />

        <div className="mt-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{unit.name}</h1>
          {unit.description && <p className="mt-1 text-muted-foreground">{unit.description}</p>}
        </div>

        {canWrite && (
          <form onSubmit={startSession} className="mt-6 flex gap-2">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Start a session in this unit — e.g. Singly linked lists"
            />
            <Button type="submit" disabled={creating}>
              <Plus className="h-4 w-4" /> {creating ? "Starting…" : "Start"}
            </Button>
          </form>
        )}

        <div className="mt-8">
          <LevelStatsPanel load={() => unitApi.stats(unitId)} />
        </div>

        <h2 className="mt-8 text-lg font-semibold">Sessions</h2>
        <div className="mt-3 space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet — start one above.</p>
          ) : (
            sessions.map((s: Session) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status] ?? ""}`}>
                  {s.status}
                </span>
                <Link
                  href={`/session/${s.id}`}
                  className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm transition-colors hover:bg-muted"
                  aria-label="Session history"
                  title="History & artifacts"
                >
                  <History className="h-4 w-4" /> History
                </Link>
                {canWrite && (
                  <Link
                    href={`/classroom/${s.id}`}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98]"
                  >
                    <Play className="h-4 w-4" /> Open
                  </Link>
                )}
                {canWrite && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Edit session"
                      title="Edit"
                      onClick={() => openEdit(s)}
                      className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete session"
                      title="Delete"
                      onClick={() => setDeleting(s)}
                      className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </main>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit session">
        <form onSubmit={saveEdit} className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Subject</p>
            <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Session subject" />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Language</p>
            <select
              aria-label="Language"
              value={editLanguage}
              onChange={(e) => setEditLanguage(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50"
            >
              {LANGUAGES.map((l) => (
                <option key={l.label} value={l.label}>{l.label}</option>
              ))}
            </select>
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Delete session?"
        message={
          deleting && (
            <>
              Permanently delete the session <span className="font-medium text-foreground">{deleting.subject}</span> —
              including its transcript, generated artifacts and any quizzes. This can’t be undone.
            </>
          )
        }
      />
    </div>
  );
}
