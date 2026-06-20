"use client";

import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Plus, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Aurora } from "@/components/ui/aurora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { courseApi, sessionApi, type CourseDetail } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/15 text-success",
  paused: "bg-accent/15 text-accent",
  completed: "bg-muted text-muted-foreground",
};

export function CourseDetailView({ courseId }: { courseId: string }) {
  const ready = useRequireAuth();
  const router = useRouter();
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [roster, setRoster] = useState<{ name: string }[]>([]);
  const [student, setStudent] = useState("");
  const [subject, setSubject] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!ready) return;
    courseApi
      .get(courseId)
      .then((d) => {
        setDetail(d);
        setRoster(d.course.roster ?? []);
      })
      .catch(() => toast.error("Could not load course"));
  }, [ready, courseId]);

  async function saveRoster(next: { name: string }[]) {
    setRoster(next);
    try {
      await courseApi.update(courseId, { roster: next });
    } catch {
      toast.error("Could not save roster");
    }
  }

  function addStudent(e: React.FormEvent) {
    e.preventDefault();
    const n = student.trim();
    if (!n) return;
    saveRoster([...roster, { name: n }]);
    setStudent("");
  }

  async function startSession(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    setCreating(true);
    try {
      const s = await sessionApi.create(subject.trim(), courseId);
      router.push(`/classroom/${s.id}`);
    } catch {
      toast.error("Could not start session");
      setCreating(false);
    }
  }

  async function removeCourse() {
    if (!confirm("Delete this course? Its sessions will be kept, just un-grouped.")) return;
    try {
      await courseApi.remove(courseId);
      router.push("/courses");
    } catch {
      toast.error("Could not delete course");
    }
  }

  if (!ready || !detail) return null;

  return (
    <div className="relative flex flex-1 flex-col">
      <Aurora className="opacity-40" />

      <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/courses"
            className="grid h-9 w-9 place-items-center rounded-full border border-border transition-colors hover:bg-muted"
            aria-label="Back to courses"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-semibold">{detail.course.name}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={removeCourse}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-6 py-10 lg:grid-cols-[1fr_18rem]">
        {/* Sessions */}
        <div>
          <form onSubmit={startSession} className="flex gap-2">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Start a session in this course…"
            />
            <Button type="submit" disabled={creating}>
              <Plus className="h-4 w-4" /> {creating ? "Starting…" : "Start"}
            </Button>
          </form>

          <h2 className="mt-8 text-lg font-semibold">Sessions</h2>
          <div className="mt-3 space-y-2">
            {detail.sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions in this course yet.</p>
            ) : (
              detail.sessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/classroom/${s.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status] ?? ""}`}>
                    {s.status}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Roster */}
        <aside>
          <h2 className="text-lg font-semibold">Roster</h2>
          <p className="mt-1 text-xs text-muted-foreground">{roster.length} students</p>
          <form onSubmit={addStudent} className="mt-3 flex gap-2">
            <Input
              value={student}
              onChange={(e) => setStudent(e.target.value)}
              placeholder="Add a name"
              className="h-9"
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" aria-label="Add student">
              <UserPlus className="h-4 w-4" />
            </Button>
          </form>
          <div className="mt-3 space-y-1.5">
            {roster.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
              >
                <span className="truncate">{r.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${r.name}`}
                  onClick={() => saveRoster(roster.filter((_, j) => j !== i))}
                  className="text-muted-foreground transition-colors hover:text-danger"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
