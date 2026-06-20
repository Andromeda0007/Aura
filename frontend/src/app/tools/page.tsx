"use client";

import {
  ArrowLeft,
  CheckSquare,
  ClipboardList,
  FileText,
  Languages,
  Sparkles,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Aurora } from "@/components/ui/aurora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { toolsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type ToolKey = "differentiate" | "lesson" | "worksheet" | "rubric" | "grade" | "standards";

const TOOLS: { key: ToolKey; label: string; icon: typeof Sparkles; blurb: string }[] = [
  { key: "differentiate", label: "Differentiate", icon: Languages, blurb: "Rewrite any content for a reading level or ELL/IEP." },
  { key: "lesson", label: "Lesson plan", icon: ClipboardList, blurb: "A full plan from a topic — objectives to homework." },
  { key: "worksheet", label: "Worksheet", icon: FileText, blurb: "Printable practice with an answer key." },
  { key: "rubric", label: "Rubric", icon: CheckSquare, blurb: "A 4-level grading rubric for any assignment." },
  { key: "grade", label: "Auto-grade", icon: Sparkles, blurb: "Score an open response with feedback." },
  { key: "standards", label: "Standards", icon: Tag, blurb: "Align content to academic standards." },
];

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-32 w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        props.className,
      )}
    />
  );
}

export default function ToolsPage() {
  const ready = useRequireAuth();
  const [tool, setTool] = useState<ToolKey>("differentiate");
  if (!ready) return null;

  return (
    <div className="relative flex flex-1 flex-col">
      <Aurora className="opacity-40" />
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Link
          href="/dashboard"
          className="grid h-9 w-9 place-items-center rounded-full border border-border transition-colors hover:bg-muted"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-semibold">Teacher tools</h1>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-6 py-10 lg:grid-cols-[16rem_1fr]">
        <nav className="space-y-1">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTool(t.key)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                tool === t.key
                  ? "border-primary/40 bg-primary/5"
                  : "border-transparent hover:bg-muted",
              )}
            >
              <t.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t.label}</span>
                <span className="block text-xs text-muted-foreground">{t.blurb}</span>
              </span>
            </button>
          ))}
        </nav>

        <section>
          {tool === "differentiate" && <Differentiate />}
          {tool === "lesson" && <LessonPlan />}
          {tool === "worksheet" && <Worksheet />}
          {tool === "rubric" && <Rubric />}
          {tool === "grade" && <Grade />}
          {tool === "standards" && <Standards />}
        </section>
      </main>
    </div>
  );
}

function useRun<T>(fn: () => Promise<T>) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<T | null>(null);
  async function run() {
    setLoading(true);
    try {
      const r = await fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((r as any)?.error) toast.error((r as any).error);
      setResult(r);
    } catch {
      toast.error("Generation failed");
    } finally {
      setLoading(false);
    }
  }
  return { loading, result, run };
}

function ResultCard({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 rounded-2xl border border-border bg-card p-5">{children}</div>;
}

function Differentiate() {
  const [content, setContent] = useState("");
  const [level, setLevel] = useState("middle");
  const { loading, result, run } = useRun(() => toolsApi.differentiate(content, level));
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">Differentiate content</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste a summary or explanation; get a version pitched at the right level.
      </p>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste the content to adapt…"
        className="mt-4"
      />
      <div className="mt-3 flex items-center gap-2">
        <select
          aria-label="Reading level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="h-10 rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="elementary">Elementary</option>
          <option value="middle">Middle school</option>
          <option value="high">High school</option>
          <option value="ell">English learners (ELL)</option>
          <option value="advanced">Advanced</option>
          <option value="simplified">Simplified (IEP)</option>
        </select>
        <Button onClick={run} disabled={loading || !content.trim()}>
          {loading ? "Adapting…" : "Adapt"}
        </Button>
      </div>
      {result?.content && (
        <ResultCard>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.content}</p>
          {result.notes?.length > 0 && (
            <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              {result.notes.map((n: string, i: number) => (
                <li key={i}>• {n}</li>
              ))}
            </ul>
          )}
        </ResultCard>
      )}
    </div>
  );
}

function LessonPlan() {
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("middle school");
  const [minutes, setMinutes] = useState(45);
  const { loading, result, run } = useRun(() => toolsApi.lessonPlan(topic, grade, minutes));
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">Lesson plan</h2>
      <p className="mt-1 text-sm text-muted-foreground">A complete plan from a topic or notes.</p>
      <Textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Topic or lesson notes…"
        className="mt-4"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade level" className="w-44" />
        <Input
          type="number"
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="w-28"
          aria-label="Minutes"
        />
        <Button onClick={run} disabled={loading || !topic.trim()}>
          {loading ? "Planning…" : "Generate plan"}
        </Button>
      </div>
      {result?.title && (
        <ResultCard>
          <h3 className="font-display text-lg font-semibold">{result.title}</h3>
          <Section title="Objectives" items={result.objectives} />
          <Section title="Materials" items={result.materials} />
          {result.activities?.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Activities</p>
              <div className="space-y-2">
                {result.activities.map((a: { name: string; minutes: number; description: string }, i: number) => (
                  <div key={i} className="rounded-xl border border-border p-3">
                    <p className="flex items-center justify-between text-sm font-medium">
                      {a.name}
                      <span className="text-xs text-muted-foreground">{a.minutes} min</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.assessment && <Para title="Assessment" body={result.assessment} />}
          {result.homework && <Para title="Homework" body={result.homework} />}
        </ResultCard>
      )}
    </div>
  );
}

function Worksheet() {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(8);
  const [showKey, setShowKey] = useState(false);
  const { loading, result, run } = useRun(() => toolsApi.worksheet(topic, count));
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">Worksheet</h2>
      <p className="mt-1 text-sm text-muted-foreground">Practice problems with a hideable answer key.</p>
      <Textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Topic or skills to practice…"
        className="mt-4"
      />
      <div className="mt-3 flex items-center gap-2">
        <Input
          type="number"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-24"
          aria-label="Number of questions"
        />
        <Button onClick={run} disabled={loading || !topic.trim()}>
          {loading ? "Building…" : "Build worksheet"}
        </Button>
      </div>
      {result?.title && (
        <ResultCard>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">{result.title}</h3>
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="text-xs text-primary hover:underline"
            >
              {showKey ? "Hide answers" : "Show answers"}
            </button>
          </div>
          {result.instructions && <p className="mt-1 text-sm text-muted-foreground">{result.instructions}</p>}
          <ol className="mt-4 space-y-3">
            {result.problems?.map((p: { question: string; answer: string }, i: number) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{i + 1}.</span> {p.question}
                {showKey && (
                  <p className="mt-1 rounded-lg bg-success/10 px-3 py-1.5 text-xs text-success">
                    Answer: {p.answer}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </ResultCard>
      )}
    </div>
  );
}

function Rubric() {
  const [assignment, setAssignment] = useState("");
  const { loading, result, run } = useRun(() => toolsApi.rubric(assignment));
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">Rubric</h2>
      <p className="mt-1 text-sm text-muted-foreground">A 4-level rubric for any assignment.</p>
      <Textarea
        value={assignment}
        onChange={(e) => setAssignment(e.target.value)}
        placeholder="Describe the assignment…"
        className="mt-4"
      />
      <Button className="mt-3" onClick={run} disabled={loading || !assignment.trim()}>
        {loading ? "Drafting…" : "Generate rubric"}
      </Button>
      {result?.criteria && (
        <ResultCard>
          <h3 className="mb-3 font-display text-lg font-semibold">{result.title}</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-border bg-muted px-3 py-2 text-left font-medium">Criterion</th>
                  {result.levels?.map((l: string, i: number) => (
                    <th key={i} className="border border-border bg-muted px-3 py-2 text-left font-medium">
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.criteria.map(
                  (c: { name: string; descriptions: string[] }, i: number) => (
                    <tr key={i}>
                      <td className="border border-border px-3 py-2 font-medium">{c.name}</td>
                      {c.descriptions?.map((d: string, j: number) => (
                        <td key={j} className="border border-border px-3 py-2 text-muted-foreground">
                          {d}
                        </td>
                      ))}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </ResultCard>
      )}
    </div>
  );
}

function Grade() {
  const [question, setQuestion] = useState("");
  const [guidance, setGuidance] = useState("");
  const [response, setResponse] = useState("");
  const { loading, result, run } = useRun(() => toolsApi.grade(question, guidance, response));
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">Auto-grade</h2>
      <p className="mt-1 text-sm text-muted-foreground">Score an open-ended response with feedback.</p>
      <Input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="The question / prompt"
        className="mt-4"
      />
      <Input
        value={guidance}
        onChange={(e) => setGuidance(e.target.value)}
        placeholder="Grading guidance (optional)"
        className="mt-2"
      />
      <Textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Student's response…"
        className="mt-2"
      />
      <Button className="mt-3" onClick={run} disabled={loading || !question.trim() || !response.trim()}>
        {loading ? "Grading…" : "Grade response"}
      </Button>
      {typeof result?.score === "number" && (
        <ResultCard>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold">{result.score}</span>
            <span className="text-muted-foreground">/ {result.max}</span>
          </div>
          {result.feedback && <p className="mt-3 text-sm">{result.feedback}</p>}
          <Section title="Strengths" items={result.strengths} />
          <Section title="To improve" items={result.improvements} />
        </ResultCard>
      )}
    </div>
  );
}

function Standards() {
  const [content, setContent] = useState("");
  const { loading, result, run } = useRun(() => toolsApi.standards(content));
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">Standards alignment</h2>
      <p className="mt-1 text-sm text-muted-foreground">Suggested standards for your content.</p>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste the lesson content…"
        className="mt-4"
      />
      <Button className="mt-3" onClick={run} disabled={loading || !content.trim()}>
        {loading ? "Aligning…" : "Suggest standards"}
      </Button>
      {result?.standards && (
        <ResultCard>
          <div className="space-y-2">
            {result.standards.map((s: { code: string; description: string }, i: number) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <p className="font-mono text-sm font-semibold">{s.code}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
          {result.note && <p className="mt-3 text-xs text-muted-foreground">{result.note}</p>}
        </ResultCard>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1 text-sm">
        {items.map((it, i) => (
          <li key={i}>• {it}</li>
        ))}
      </ul>
    </div>
  );
}

function Para({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
