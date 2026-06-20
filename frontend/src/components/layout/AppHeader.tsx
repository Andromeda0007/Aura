"use client";

import {
  BarChart3,
  ClipboardList,
  FileQuestion,
  GraduationCap,
  Library,
  LogOut,
  MoreHorizontal,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

type NavItem = { href: string; label: string; icon: typeof GraduationCap };

const ROLE_LABEL: Record<string, string> = { admin: "Admin", teacher: "Teacher", student: "Student" };

function navFor(role: string | undefined): { primary: NavItem[]; more: NavItem[] } {
  if (role === "student") return { primary: [], more: [] };
  const primary: NavItem[] = [
    { href: "/dashboard", label: "Batches", icon: GraduationCap },
    { href: "/tools", label: "Tools", icon: Sparkles },
    { href: "/stats", label: "Stats", icon: BarChart3 },
  ];
  if (role === "admin") primary.splice(1, 0, { href: "/admin/users", label: "Users", icon: Users });
  const more: NavItem[] = [
    { href: "/assignments", label: "Homework", icon: ClipboardList },
    { href: "/quizzes", label: "Quiz results", icon: FileQuestion },
    { href: "/library", label: "Library", icon: Library },
  ];
  return { primary, more };
}

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useRole();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const { primary, more } = navFor(role);
  const initials = (user?.full_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            A
          </span>
          <span className="font-semibold tracking-tight">Aura</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {primary.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors",
                isActive(item.href) ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </Link>
          ))}
          {more.length > 0 && (
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors",
                  more.some((m) => isActive(m.href)) ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <MoreHorizontal className="h-4 w-4" /> More
              </button>
              {moreOpen && (
                <div className="absolute left-0 top-11 w-48 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg">
                  {more.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                        isActive(item.href) ? "bg-muted" : "hover:bg-muted",
                      )}
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground" /> {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        {role !== "student" && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="hidden h-9 items-center gap-2 rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted lg:flex"
            aria-label="Open command palette"
          >
            Search
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </button>
        )}

        {/* Single profile section — name, role, theme, log out */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            aria-label="Profile menu"
            onClick={() => setProfileOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-full bg-muted text-sm font-semibold transition-colors hover:bg-muted/70"
          >
            {initials}
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-11 w-60 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg">
              <div className="px-3 py-2">
                <p className="truncate text-sm font-medium">{user?.full_name}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate">{user?.email}</span>
                </p>
                {role && (
                  <span className="mt-1.5 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {ROLE_LABEL[role] ?? role}
                  </span>
                )}
              </div>
              <div className="my-1 flex items-center justify-between px-3 py-1.5">
                <span className="text-xs text-muted-foreground">Theme</span>
                <ThemeToggle />
              </div>
              <Link
                href="/settings"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <Settings className="h-4 w-4 text-muted-foreground" /> Profile & settings
              </Link>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.replace("/auth/login");
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/10"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
