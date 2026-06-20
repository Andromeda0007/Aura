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
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

// Primary nav stays small (legible, low cognitive load); the rest lives behind "More".
const PRIMARY = [
  { href: "/dashboard", label: "Batches", icon: GraduationCap },
  { href: "/tools", label: "Tools", icon: Sparkles },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];
const MORE = [
  { href: "/assignments", label: "Homework", icon: ClipboardList },
  { href: "/quizzes", label: "Quiz results", icon: FileQuestion },
  { href: "/library", label: "Library", icon: Library },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

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
          {PRIMARY.map((item) => (
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
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors",
                MORE.some((m) => isActive(m.href)) ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <MoreHorizontal className="h-4 w-4" /> More
            </button>
            {moreOpen && (
              <div className="absolute left-0 top-11 w-48 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg">
                {MORE.map((item) => (
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
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="hidden h-9 items-center gap-2 rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted lg:flex"
          aria-label="Open command palette"
        >
          Search
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </button>
        <span className="hidden text-sm text-muted-foreground lg:inline">{user?.full_name}</span>
        <Link
          href="/settings"
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full border border-border transition-colors hover:bg-muted",
            isActive("/settings") && "bg-muted",
          )}
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Log out"
          onClick={() => {
            logout();
            router.replace("/auth/login");
          }}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
