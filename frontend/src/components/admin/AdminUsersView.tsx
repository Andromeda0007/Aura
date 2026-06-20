"use client";

import { Trash2, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { Aurora } from "@/components/ui/aurora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useIsAdmin } from "@/hooks/useRole";
import { adminApi, type AdminTreeBatch, type AdminUser } from "@/lib/api";
import { cn } from "@/lib/utils";

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-primary/15 text-primary",
  teacher: "bg-success/15 text-success",
  student: "bg-accent/15 text-accent",
};

interface Picked {
  id: string;
  label: string;
}

export function AdminUsersView() {
  const ready = useRequireAuth();
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tree, setTree] = useState<AdminTreeBatch[]>([]);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("teacher");
  const [saving, setSaving] = useState(false);

  // selection state
  const [picked, setPicked] = useState<Picked[]>([]);
  const [deptName, setDeptName] = useState(""); // teacher: department (subject) first
  const [batchId, setBatchId] = useState(""); // student: batch first
  const [deptId, setDeptId] = useState(""); // student: dept within batch

  async function refresh() {
    setUsers(await adminApi.listUsers());
  }

  useEffect(() => {
    if (!ready) return;
    if (!isAdmin) {
      router.replace("/dashboard");
      return;
    }
    refresh().catch(() => toast.error("Could not load users"));
    adminApi.tree().then(setTree).catch(() => {});
  }, [ready, isAdmin, router]);

  function resetSelection() {
    setPicked([]);
    setDeptName("");
    setBatchId("");
    setDeptId("");
  }

  // distinct department names across all batches (teachers pick one subject area)
  const deptNames = useMemo(
    () => [...new Set(tree.flatMap((b) => b.departments.map((d) => d.name)))].sort(),
    [tree],
  );
  // for the chosen department name: each batch that has it
  const teacherRows = useMemo(
    () =>
      tree
        .map((b) => ({ batch: b, dept: b.departments.find((d) => d.name === deptName) }))
        .filter((x) => x.dept),
    [tree, deptName],
  );

  const studentBatch = tree.find((b) => b.id === batchId);
  const studentDept = studentBatch?.departments.find((d) => d.id === deptId);

  function togglePicked(id: string, label: string, single: boolean) {
    setPicked((p) => {
      if (single) return [{ id, label }];
      return p.some((x) => x.id === id) ? p.filter((x) => x.id !== id) : [...p, { id, label }];
    });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || password.length < 8) {
      toast.error("Fill name, email, and an 8+ char password");
      return;
    }
    if (role !== "admin" && picked.length === 0) {
      toast.error(role === "student" ? "Pick one semester" : "Pick at least one semester");
      return;
    }
    if (role === "student" && picked.length !== 1) {
      toast.error("A student must be assigned exactly one semester");
      return;
    }
    setSaving(true);
    try {
      await adminApi.createUser({
        email: email.trim(),
        full_name: fullName.trim(),
        password,
        role,
        semester_ids: role === "admin" ? [] : picked.map((p) => p.id),
      });
      setEmail("");
      setFullName("");
      setPassword("");
      resetSelection();
      await refresh();
      toast.success("Account created");
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Could not create account");
    } finally {
      setSaving(false);
    }
  }

  async function remove(u: AdminUser) {
    if (!confirm(`Delete ${u.fullName} (${u.email})?`)) return;
    try {
      await adminApi.deleteUser(u.id);
      await refresh();
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Could not delete");
    }
  }

  if (!ready || !isAdmin) return null;

  return (
    <div className="relative flex flex-1 flex-col">
      <Aurora className="opacity-40" />
      <AppHeader />

      <main className="mx-auto grid w-full flex-1 gap-8 px-6 py-10 lg:px-[10%] xl:grid-cols-[1fr_26rem]">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">People</h1>
          <p className="mt-1 text-muted-foreground">Teachers, students, and admins.</p>
          <div className="mt-6 space-y-2">
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts yet — create one on the right.</p>
            ) : (
              users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium">
                      <span className="truncate">{u.fullName}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ROLE_BADGE[u.role])}>{u.role}</span>
                      {!u.isActive && <span className="text-xs text-muted-foreground">(disabled)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.email}
                      {u.role !== "admin" && ` · ${u.semesterIds.length} class${u.semesterIds.length === 1 ? "" : "es"}`}
                    </p>
                  </div>
                  <button type="button" aria-label={`Delete ${u.fullName}`} onClick={() => remove(u)} className="shrink-0 text-muted-foreground transition-colors hover:text-danger">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <aside>
          <h2 className="text-lg font-semibold">New account</h2>
          <form onSubmit={create} className="mt-3 space-y-2">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" />
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temp password (8+ chars)" />
            <select
              aria-label="Role"
              value={role}
              onChange={(e) => { setRole(e.target.value); resetSelection(); }}
              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>

            {/* TEACHER: department first, then semesters across any batches of that dept */}
            {role === "teacher" && (
              <div className="space-y-2 rounded-xl border border-border p-3">
                <select
                  aria-label="Department"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select department…</option>
                  {deptNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                {deptName && teacherRows.map(({ batch, dept }) => (
                  <div key={dept!.id}>
                    <p className="mb-1 mt-1 text-xs font-medium text-muted-foreground">Batch {batch.label}</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {dept!.semesters.map((s) => {
                        const label = `${deptName} · ${batch.label} · Sem ${s.number}`;
                        const on = picked.some((p) => p.id === s.id);
                        return (
                          <button key={s.id} type="button" onClick={() => togglePicked(s.id, label, false)}
                            className={cn("rounded-lg border px-2 py-1.5 text-xs", on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted")}>
                            S{s.number}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* STUDENT: batch -> department -> one semester */}
            {role === "student" && (
              <div className="space-y-2 rounded-xl border border-border p-3">
                <select aria-label="Batch" value={batchId} onChange={(e) => { setBatchId(e.target.value); setDeptId(""); setPicked([]); }}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Select batch…</option>
                  {tree.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
                <select aria-label="Department" value={deptId} onChange={(e) => { setDeptId(e.target.value); setPicked([]); }} disabled={!batchId}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                  <option value="">Select department…</option>
                  {studentBatch?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {studentDept && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {studentDept.semesters.map((s) => {
                      const label = `${studentDept.name} · ${studentBatch!.label} · Sem ${s.number}`;
                      const on = picked.some((p) => p.id === s.id);
                      return (
                        <button key={s.id} type="button" onClick={() => togglePicked(s.id, label, true)}
                          className={cn("rounded-lg border px-2 py-1.5 text-xs", on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted")}>
                          S{s.number}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* selected chips */}
            {role !== "admin" && picked.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {picked.map((p) => (
                  <span key={p.id} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                    {p.label}
                    <button type="button" aria-label={`Remove ${p.label}`} onClick={() => setPicked((cur) => cur.filter((x) => x.id !== p.id))} className="text-muted-foreground hover:text-danger">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <Button type="submit" disabled={saving} className="w-full">
              <UserPlus className="h-4 w-4" /> {saving ? "Creating…" : "Create account"}
            </Button>
          </form>
        </aside>
      </main>
    </div>
  );
}
