"use client";

import { GraduationCap, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { Aurora } from "@/components/ui/aurora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { courseApi, type CourseSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
};

export default function CoursesPage() {
  const ready = useRequireAuth();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!ready) return;
    courseApi.list().then(setCourses).catch(() => toast.error("Could not load courses"));
  }, [ready]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const palette = Object.keys(COLORS);
      const color = palette[courses.length % palette.length];
      await courseApi.create(name.trim(), color);
      setName("");
      setCourses(await courseApi.list());
    } catch {
      toast.error("Could not create course");
    } finally {
      setCreating(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="relative flex flex-1 flex-col">
      <Aurora className="opacity-40" />

      <AppHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Your classes</h2>
        <p className="mt-1 text-muted-foreground">
          Group sessions by class and keep a roster for each.
        </p>

        <form onSubmit={create} className="mt-6 flex max-w-md gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New course — e.g. Period 3 Biology"
          />
          <Button type="submit" disabled={creating}>
            <Plus className="h-4 w-4" /> {creating ? "Adding…" : "Add"}
          </Button>
        </form>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center">
              <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No courses yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create one above to get started.</p>
            </div>
          ) : (
            courses.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted"
              >
                <span className={cn("inline-block h-2.5 w-2.5 rounded-full", COLORS[c.color] ?? COLORS.indigo)} />
                <h3 className="mt-3 font-medium leading-snug">{c.name}</h3>
                <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{c.sessions} session{c.sessions === 1 ? "" : "s"}</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {c.students}
                  </span>
                </p>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
