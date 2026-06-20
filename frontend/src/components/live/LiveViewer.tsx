"use client";

import { Radio } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ResponseView } from "@/components/ai-panel/ResponseView";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { liveApi } from "@/lib/api";
import { connectStudentSocket, disconnectSocket } from "@/lib/socket";
import type { AIResponse, TranscriptEntry } from "@/types";

type Status = "loading" | "ok" | "error";

export function LiveViewer({ code }: { code: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [subject, setSubject] = useState("");
  const [connected, setConnected] = useState(false);
  const [board, setBoard] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [responses, setResponses] = useState<AIResponse[]>([]);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    liveApi
      .resolve(code)
      .then((info) => {
        setSubject(info.subject);
        setStatus("ok");

        const socket = connectStudentSocket(info.joinCode);
        socket.on("connect", () => setConnected(true));
        socket.on("disconnect", () => setConnected(false));
        socket.on("connected", (d: { subject?: string }) => {
          setConnected(true);
          if (d?.subject) setSubject(d.subject);
        });
        socket.on("board_update", (d: { image?: string }) => {
          if (d?.image) setBoard(d.image);
        });
        socket.on("transcript_update", (d: { id?: string; text: string; timestamp?: string }) =>
          setTranscripts((prev) =>
            [
              ...prev,
              {
                id: d.id ?? crypto.randomUUID(),
                text: d.text,
                timestamp: d.timestamp ?? new Date().toISOString(),
              },
            ].slice(-50),
          ),
        );
        socket.on("command_response", (d: AIResponse) =>
          setResponses((prev) => [d, ...prev].slice(0, 12)),
        );
      })
      .catch(() => setStatus("error"));

    return () => disconnectSocket();
  }, [code]);

  if (status === "loading") {
    return <p className="p-10 text-center text-sm text-muted-foreground">Joining the class…</p>;
  }
  if (status === "error") {
    return (
      <div className="mx-auto mt-20 max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <p className="font-medium">Class not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          That join code is invalid or the class has ended.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">
            A
          </Link>
          <div className="min-w-0">
            <p className="truncate font-semibold">{subject}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-muted-foreground"}`} />
              {connected ? "Live" : "Connecting…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger">
            <Radio className="h-3.5 w-3.5" /> Watching
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-[1fr_22rem]">
        {/* Board mirror */}
        <section className="relative min-h-0 overflow-hidden rounded-2xl border border-border bg-card">
          {board ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={board} alt="Live board" className="h-full w-full object-contain" />
          ) : (
            <div className="grid h-full place-items-center px-6 text-center">
              <div>
                <p className="text-sm font-medium">Waiting for the board…</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your teacher&apos;s board will appear here as they write.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Aura content + transcript */}
        <section className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              From Aura
            </p>
            {responses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Summaries, quizzes and diagrams will show up here.
              </p>
            ) : (
              <div className="space-y-3">
                {responses.map((r, i) => (
                  <ResponseView key={r.commandId ?? i} response={r} />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Transcript
            </p>
            {transcripts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Live captions will appear here.</p>
            ) : (
              <div className="space-y-1.5 text-sm">
                {transcripts.slice(-12).map((t) => (
                  <p key={t.id}>{t.text}</p>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
