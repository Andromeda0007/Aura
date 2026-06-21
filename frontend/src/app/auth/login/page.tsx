"use client";

import { BookOpen, GraduationCap, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Aurora } from "@/components/ui/aurora";
import { Button } from "@/components/ui/button";
import { LectureGhosts } from "@/components/ui/lecture-ghosts";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "admin", label: "Admin", icon: Shield },
  { value: "teacher", label: "Teacher", icon: GraduationCap },
  { value: "student", label: "Student", icon: BookOpen },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [role, setRole] = useState<"admin" | "teacher" | "student">("teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { user, tokens } = await authApi.login({ email, password });
      // The chosen portal must match the account's actual role (server is source of truth).
      if (user.role !== role) {
        const label = ROLES.find((r) => r.value === user.role)?.label ?? user.role;
        toast.error(`This is a ${label} account — switch the selector to ${label}.`);
        return;
      }
      setAuth(user, tokens);
      toast.success(`Welcome back, ${user.full_name.split(" ")[0]}`);
      router.push("/dashboard"); // dashboard routes by role
    } catch {
      toast.error("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <Aurora />
      <LectureGhosts variant="login" />
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">
            A
          </span>
          <span className="font-semibold">Aura</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm"
        >
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose your role and log in.</p>

          {/* Role / portal selector */}
          <div
            role="radiogroup"
            aria-label="Log in as"
            className="mt-5 grid grid-cols-3 gap-1.5 rounded-xl border border-border bg-background p-1"
          >
            {ROLES.map(({ value, label, icon: Icon }) => {
              const active = role === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setRole(value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input
                id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <PasswordInput
                id="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
          </div>

          <Button type="submit" className="mt-6 w-full" size="lg" disabled={loading}>
            {loading ? "Logging in…" : `Log in as ${ROLES.find((r) => r.value === role)?.label}`}
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Accounts are created by your admin.
          </p>
        </form>
      </main>
    </div>
  );
}
