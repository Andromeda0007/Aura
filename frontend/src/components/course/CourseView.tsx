"use client";

import { BookOpen, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CourseCover } from "@/components/course/CourseCover";
import { AppHeader } from "@/components/layout/AppHeader";
import { Breadcrumbs, batchTitle, type Crumb } from "@/components/layout/Breadcrumbs";
import { LevelStatsPanel } from "@/components/stats/LevelStatsPanel";
import { AppBackdrop } from "@/components/ui/app-backdrop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useCanWrite } from "@/hooks/useRole";
import { batchApi, courseApi, semesterApi, unitApi, type CourseDetail } from "@/lib/api";

export function CourseView({ courseId }: { courseId: string }) {
  const ready = useRequireAuth();
  const canWrite = useCanWrite();
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ label: "Batches", href: "/dashboard" }]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const d = await courseApi.get(courseId);
    setDetail(d);
    return d;
  }

  useEffect(() => {
    if (!ready) return;
    refresh()
      .then(async (d) => {
        try {
          const sem = await semesterApi.get(d.course.semester_id);
          const dept = sem.department;
          const b = dept ? await batchApi.get(dept.batch_id) : null;
          setCrumbs([
            { label: "Batches", href: "/dashboard" },
            ...(b ? [{ label: batchTitle(b), href: `/batch/${b.id}` }] : []),
            ...(dept ? [{ label: dept.name, href: `/department/${dept.id}` }] : []),
            { label: `Semester ${sem.semester.number}`, href: `/semester/${sem.semester.id}` },
            { label: d.course.name },
          ]);
        } catch {
          setCrumbs([{ label: "Batches", href: "/dashboard" }, { label: d.course.name }]);
        }
      })
      .catch(() => toast.error("Course not found"));
  }, [ready, courseId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await unitApi.create({
        course_id: courseId,
        name: name.trim(),
        description: description.trim(),
        order: detail?.units.length ?? 0,
      });
      setName("");
      setDescription("");
      setShowForm(false);
      await refresh();
    } catch {
      toast.error("Could not create unit");
    } finally {
      setCreating(false);
    }
  }

  if (!ready || !detail) return null;
  const { course, counts, units } = detail;

  return (
    <div className="relative flex flex-1 flex-col">
      <AppBackdrop />
      <AppHeader />

      <main className="mx-auto w-full flex-1 px-6 py-8 lg:px-[10%]">
        <Breadcrumbs items={crumbs} />

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <CourseCover coverKey={course.cover} className="h-16 w-24 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-semibold tracking-tight">{course.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {course.professor || "No professor set"} · {counts.sessions} sessions · {counts.items} items ·{" "}
              <span className="inline-flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" /> {counts.tokensUsed.toLocaleString()} tokens
              </span>
            </p>
          </div>
          {canWrite && (
            <Button onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" /> New unit
            </Button>
          )}
        </div>

        {canWrite && showForm && (
          <form onSubmit={create} className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[2fr_3fr_auto]">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Unit name (e.g. Linked Lists)" />
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description (optional)" />
            <Button type="submit" disabled={creating}>{creating ? "…" : "Add unit"}</Button>
          </form>
        )}

        <div className="mt-8">
          <LevelStatsPanel load={() => courseApi.stats(courseId)} />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {units.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No units yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Break the course into chapters above.</p>
            </div>
          ) : (
            units.map((u, i) => (
              <Link
                key={u.id}
                href={`/unit/${u.id}`}
                className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-primary">Unit {i + 1}</p>
                <h3 className="mt-1 font-medium leading-snug">{u.name}</h3>
                {u.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{u.description}</p>}
                <p className="mt-3 text-xs text-muted-foreground">
                  {u.sessions} session{u.sessions === 1 ? "" : "s"}
                </p>
              </Link>
            ))
          )}
        </div>

      </main>
    </div>
  );
}
