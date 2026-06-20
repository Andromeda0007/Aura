"use client";

import { BookOpen, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { COVER_KEYS, CourseCover, coverOf } from "@/components/course/CourseCover";
import { AppHeader } from "@/components/layout/AppHeader";
import { Breadcrumbs, batchTitle, type Crumb } from "@/components/layout/Breadcrumbs";
import { LevelStatsPanel } from "@/components/stats/LevelStatsPanel";
import { Aurora } from "@/components/ui/aurora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useCanWrite } from "@/hooks/useRole";
import { batchApi, courseApi, semesterApi, type SemesterDetail } from "@/lib/api";
import { cn } from "@/lib/utils";

const ACCENTS = ["indigo", "emerald", "rose", "amber", "sky"];
const ACCENT_DOT: Record<string, string> = {
  indigo: "bg-indigo-500", emerald: "bg-emerald-500", rose: "bg-rose-500", amber: "bg-amber-500", sky: "bg-sky-500",
};

export function SemesterView({ semesterId }: { semesterId: string }) {
  const ready = useRequireAuth();
  const canWrite = useCanWrite();
  const [detail, setDetail] = useState<SemesterDetail | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ label: "Batches", href: "/dashboard" }]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [professor, setProfessor] = useState("");
  const [cover, setCover] = useState(COVER_KEYS[0]);
  const [color, setColor] = useState("indigo");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const d = await semesterApi.get(semesterId);
    setDetail(d);
    return d;
  }

  useEffect(() => {
    if (!ready) return;
    refresh()
      .then(async (d) => {
        if (!d.department) return;
        try {
          const b = await batchApi.get(d.department.batch_id);
          setCrumbs([
            { label: "Batches", href: "/dashboard" },
            { label: batchTitle(b), href: `/batch/${b.id}` },
            { label: d.department.name, href: `/department/${d.department.id}` },
            { label: `Semester ${d.semester.number}` },
          ]);
        } catch {
          setCrumbs([{ label: "Batches", href: "/dashboard" }, { label: `Semester ${d.semester.number}` }]);
        }
      })
      .catch(() => toast.error("Class not found"));
  }, [ready, semesterId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await courseApi.create({ semester_id: semesterId, name: name.trim(), professor: professor.trim(), cover, color });
      setName("");
      setProfessor("");
      setShowForm(false);
      await refresh();
    } catch {
      toast.error("Could not create course");
    } finally {
      setCreating(false);
    }
  }

  if (!ready || !detail) return null;
  const { semester, department, courses } = detail;

  return (
    <div className="relative flex flex-1 flex-col">
      <Aurora className="opacity-40" />
      <AppHeader />

      <main className="mx-auto w-full flex-1 px-6 py-8 lg:px-[10%]">
        <Breadcrumbs items={crumbs} />

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {department ? `${department.name} · ` : ""}Semester {semester.number}
            </h1>
            <p className="mt-1 text-muted-foreground">Courses in this class.</p>
          </div>
          {canWrite && (
            <Button onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" /> New course
            </Button>
          )}
        </div>

        {canWrite && showForm && (
          <form onSubmit={create} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Course name (e.g. DBMS)" />
              <Input value={professor} onChange={(e) => setProfessor(e.target.value)} placeholder="Professor" />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Cover</p>
              <div className="flex flex-wrap gap-2">
                {COVER_KEYS.map((k) => (
                  <button key={k} type="button" onClick={() => setCover(k)} aria-label={coverOf(k).label} title={coverOf(k).label}
                    className={cn("overflow-hidden rounded-lg ring-2 transition-all", cover === k ? "ring-primary" : "ring-transparent hover:ring-border")}>
                    <CourseCover coverKey={k} className="h-10 w-14" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">Accent</span>
              {ACCENTS.map((a) => (
                <button key={a} type="button" aria-label={a} onClick={() => setColor(a)}
                  className={cn("h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-card transition-all", ACCENT_DOT[a], color === a ? "ring-foreground" : "ring-transparent")} />
              ))}
              <Button type="submit" disabled={creating} className="ml-auto">{creating ? "Creating…" : "Create course"}</Button>
            </div>
          </form>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No courses yet</p>
              <p className="mt-1 text-sm text-muted-foreground">{canWrite ? "Add this class's subjects above." : "Nothing here yet."}</p>
            </div>
          ) : (
            courses.map((c) => (
              <Link key={c.id} href={`/course/${c.id}`} className="group overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40">
                <CourseCover coverKey={c.cover} className="h-24 w-full" />
                <div className="p-4">
                  <h3 className="font-medium leading-snug">{c.name}</h3>
                  {c.professor && <p className="text-xs text-muted-foreground">{c.professor}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{c.units} unit{c.units === 1 ? "" : "s"}</span>
                    <span>{c.items} items</span>
                    <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> {c.tokensUsed.toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="mt-8">
          <LevelStatsPanel load={() => semesterApi.stats(semesterId)} />
        </div>
      </main>
    </div>
  );
}
