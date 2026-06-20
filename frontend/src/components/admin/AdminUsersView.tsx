"use client";

import { Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { batchTitle } from "@/components/layout/Breadcrumbs";
import { Aurora } from "@/components/ui/aurora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useIsAdmin } from "@/hooks/useRole";
import {
  adminApi,
  batchApi,
  departmentApi,
  type AdminUser,
  type BatchSummary,
  type DepartmentSummary,
  type Semester,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-primary/15 text-primary",
  teacher: "bg-success/15 text-success",
  student: "bg-accent/15 text-accent",
};

export function AdminUsersView() {
  const ready = useRequireAuth();
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [batches, setBatches] = useState<BatchSummary[]>([]);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("teacher");
  const [saving, setSaving] = useState(false);

  // cascading assignment
  const [batchId, setBatchId] = useState("");
  const [depts, setDepts] = useState<DepartmentSummary[]>([]);
  const [deptId, setDeptId] = useState("");
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

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
    batchApi.list().then(setBatches).catch(() => {});
  }, [ready, isAdmin, router]);

  // load departments when batch changes
  useEffect(() => {
    setDeptId("");
    setSemesters([]);
    setPicked([]);
    if (batchId) departmentApi.list(batchId).then(setDepts).catch(() => setDepts([]));
    else setDepts([]);
  }, [batchId]);

  // load semesters when department changes
  useEffect(() => {
    setSemesters([]);
    setPicked([]);
    if (deptId) departmentApi.get(deptId).then((d) => setSemesters(d.semesters)).catch(() => {});
  }, [deptId]);

  function toggleSem(id: string) {
    if (role === "student") setPicked([id]);
    else setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || password.length < 8) {
      toast.error("Fill name, email, and an 8+ char password");
      return;
    }
    if (role !== "admin" && (deptId === "" || picked.length === 0)) {
      toast.error("Pick a department and at least one semester");
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
        semester_ids: role === "admin" ? [] : picked,
      });
      setEmail("");
      setFullName("");
      setPassword("");
      setPicked([]);
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

      <main className="mx-auto grid w-full flex-1 gap-8 px-6 py-10 lg:px-[10%] xl:grid-cols-[1fr_24rem]">
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
            <select aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPicked([]); }}
              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>

            {role !== "admin" && (
              <div className="space-y-2 rounded-xl border border-border p-3">
                <select aria-label="Batch" value={batchId} onChange={(e) => setBatchId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Select batch…</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{batchTitle(b)}</option>)}
                </select>
                <select aria-label="Department" value={deptId} onChange={(e) => setDeptId(e.target.value)} disabled={!batchId}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                  <option value="">Select department…</option>
                  {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {deptId && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {role === "student" ? "Pick one semester" : "Pick semesters (one department)"}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {semesters.map((s) => (
                        <label key={s.id} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm", picked.includes(s.id) ? "border-primary bg-primary/10" : "border-border")}>
                          <input type={role === "student" ? "radio" : "checkbox"} name="sem" checked={picked.includes(s.id)} onChange={() => toggleSem(s.id)} />
                          Sem {s.number}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
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
