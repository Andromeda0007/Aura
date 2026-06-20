"use client";

import { Check, Mic, Monitor, Moon, Sun } from "lucide-react";
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
  const { theme, setTheme } = useTheme();
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

  async function deleteAccount() {
    if (!confirm("Delete your account and all sessions? This cannot be undone.")) return;
    try {
      await authApi.deleteAccount();
      logout();
      router.replace("/auth/signup");
    } catch {
      toast.error("Could not delete account");
    }
  }

  if (!ready) return null;
  const THEMES = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ] as const;
  const micLabel = { checking: "Checking…", ok: "Ready", blocked: "Blocked — allow mic access", unsupported: "Use Chrome/Edge for voice" }[mic];

  return (
    <div className="relative flex flex-1 flex-col">
      <Aurora className="opacity-40" />
      <AppHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-6 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <Section title="Profile">
          <form onSubmit={saveName} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">{user?.email}</p>
        </Section>

        <Section title="Appearance" desc="Theme used across Aura.">
          <div className="flex gap-2">
            {THEMES.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                  theme === value ? "border-primary bg-primary/10 text-foreground" : "border-border hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
                {theme === value && <Check className="h-3.5 w-3.5 text-primary" />}
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

        <Section title="Account">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { logout(); router.replace("/auth/login"); }}>
              Log out
            </Button>
            <Button variant="danger" onClick={deleteAccount}>Delete account</Button>
          </div>
        </Section>
      </main>
    </div>
  );
}
