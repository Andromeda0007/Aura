"use client";

import { Check, LogOut, Mic, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { Aurora } from "@/components/ui/aurora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", teacher: "Teacher", student: "Student" };

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-medium">{title}</h2>
      {desc && <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const ready = useRequireAuth();
  const router = useRouter();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [mic, setMic] = useState<"checking" | "ok" | "blocked" | "unsupported">("checking");

  useEffect(() => {
    if (user) setName(user.full_name);
  }, [user]);

  useEffect(() => {
    if (!ready) return;
    const w = window as unknown as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown };
    const voice = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    if (!voice || !navigator.mediaDevices) {
      setMic("unsupported");
      return;
    }
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((p) => setMic(p.state === "denied" ? "blocked" : "ok"))
      .catch(() => setMic("ok"));
  }, [ready]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const updated = await authApi.updateProfile(name.trim());
      setUser(updated);
      toast.success("Profile updated");
    } catch {
      toast.error("Could not update profile");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;
  const current = theme === "light" || theme === "dark" ? theme : resolvedTheme;
  const THEMES = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
  ] as const;
  const micLabel = { checking: "Checking…", ok: "Ready", blocked: "Blocked — allow mic access", unsupported: "Use Chrome/Edge for voice" }[mic];

  return (
    <div className="relative flex flex-1 flex-col">
      <Aurora className="opacity-40" />
      <AppHeader />

      <main className="mx-auto w-full flex-1 space-y-4 px-6 py-8 lg:px-[10%]">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Profile</h1>

        <Section title="Your account">
          <form onSubmit={saveName} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </form>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{user?.email}</span>
            {user?.role && (
              <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            )}
          </div>
        </Section>

        <Section title="Appearance" desc="Theme used across Aura.">
          <div className="flex gap-2">
            {THEMES.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                  current === value ? "border-primary bg-primary/10 text-foreground" : "border-border hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
                {current === value && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Voice & device" desc="Aura uses your mic for live transcription and commands.">
          <div className="flex items-center gap-2 text-sm">
            <Mic className={`h-4 w-4 ${mic === "ok" ? "text-success" : "text-muted-foreground"}`} />
            <span className={mic === "ok" ? "text-success" : "text-muted-foreground"}>{micLabel}</span>
          </div>
        </Section>

        <Section title="Session">
          <Button variant="outline" onClick={() => { logout(); router.replace("/auth/login"); }}>
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </Section>
      </main>
    </div>
  );
}
