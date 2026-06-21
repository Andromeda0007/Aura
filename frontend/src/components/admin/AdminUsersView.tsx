"use client";

import { Pencil, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AssignmentPicker, buildSemesterLabels, type Picked } from "@/components/admin/AssignmentPicker";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppBackdrop } from "@/components/ui/app-backdrop";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
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

const SECTIONS: { role: "admin" | "teacher" | "student"; title: string; blurb: string }[] = [
  { role: "admin", title: "Admins", blurb: "Full access to every batch." },
  { role: "teacher", title: "Teachers", blurb: "Run classes in their assigned semesters." },
  { role: "student", title: "Students", blurb: "Belong to a single semester." },
];

function detail(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof msg === "string" ? msg : fallback;
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
  const [picked, setPicked] = useState<Picked[]>([]);
  const [saving, setSaving] = useState(false);

  // edit + delete state
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editPicked, setEditPicked] = useState<Picked[]>([]);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

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

  const semesterLabels = useMemo(() => buildSemesterLabels(tree), [tree]);
  const grouped = useMemo(
    () => ({
      admin: users.filter((u) => u.role === "admin"),
      teacher: users.filter((u) => u.role === "teacher"),
      student: users.filter((u) => u.role === "student"),
    }),
    [users],
  );

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
      setPicked([]);
      await refresh();
      toast.success("Account created");
    } catch (e2) {
      toast.error(detail(e2, "Could not create account"));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(u: AdminUser) {
    setEditing(u);
    setEditName(u.fullName);
    setEditActive(u.isActive);
    setEditPicked(u.semesterIds.map((id) => ({ id, label: semesterLabels.get(id) ?? id })));
    setErr("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editName.trim()) return;
    if (editing.role === "student" && editPicked.length !== 1) {
      setErr("A student must be assigned exactly one semester");
      return;
    }
    if (editing.role === "teacher" && editPicked.length === 0) {
      setErr("A teacher needs at least one semester");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await adminApi.updateUser(editing.id, {
        full_name: editName.trim(),
        is_active: editActive,
        ...(editing.role === "admin" ? {} : { semester_ids: editPicked.map((p) => p.id) }),
      });
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
      await adminApi.deleteUser(deleting.id);
      setDeleting(null);
      await refresh();
      toast.success("Account deleted");
    } catch (e2) {
      toast.error(detail(e2, "Could not delete"));
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !isAdmin) return null;

  return (
    <div className="relative flex flex-1 flex-col">
      <AppBackdrop />
      <AppHeader />

      <main className="mx-auto grid w-full flex-1 gap-8 px-6 py-10 lg:px-[10%] xl:grid-cols-[1fr_26rem]">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">People</h1>
          <p className="mt-1 text-muted-foreground">Teachers, students, and admins.</p>

          {users.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No accounts yet — create one on the right.</p>
          ) : (
            <div className="mt-6 space-y-8">
              {SECTIONS.map(({ role: r, title, blurb }) => {
                const list = grouped[r];
                return (
                  <section key={r}>
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-lg font-semibold">{title}</h2>
                      <span className="text-sm text-muted-foreground">{list.length}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{blurb}</p>
                    <div className="mt-3 space-y-2">
                      {list.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None yet.</p>
                      ) : (
                        list.map((u) => (
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
                            <button type="button" aria-label={`Edit ${u.fullName}`} title="Edit" onClick={() => openEdit(u)} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" aria-label={`Delete ${u.fullName}`} title="Delete" onClick={() => setDeleting(u)} className="shrink-0 text-muted-foreground transition-colors hover:text-danger">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
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
              onChange={(e) => { setRole(e.target.value); setPicked([]); }}
              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>

            <AssignmentPicker key={role} role={role} tree={tree} picked={picked} onChange={setPicked} />

            <Button type="submit" disabled={saving} className="w-full">
              <UserPlus className="h-4 w-4" /> {saving ? "Creating…" : "Create account"}
            </Button>
          </form>
        </aside>
      </main>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit account">
        {editing && (
          <form onSubmit={saveEdit} className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Full name</p>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name" />
              <p className="mt-1 text-xs text-muted-foreground">{editing.email} · {editing.role}</p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="h-4 w-4 rounded border-border" />
              Account active
            </label>

            {editing.role !== "admin" && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {editing.role === "student" ? "Semester (move to next sem here)" : "Assigned semesters"}
                </p>
                <AssignmentPicker key={editing.id} role={editing.role} tree={tree} picked={editPicked} onChange={setEditPicked} />
              </div>
            )}

            {err && <p className="text-sm text-danger">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Delete account?"
        message={
          deleting && (
            <>
              Permanently delete <span className="font-medium text-foreground">{deleting.fullName}</span> ({deleting.email}).
              This can’t be undone.
            </>
          )
        }
      />
    </div>
  );
}
