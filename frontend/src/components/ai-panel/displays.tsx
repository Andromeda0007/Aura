"use client";

import { useState } from "react";

function ErrorNote({ msg }: { msg: string }) {
  return <p className="text-sm text-danger">{msg}</p>;
}

export function SummaryDisplay({ data }: { data: { summary?: string; keyPoints?: string[]; error?: string } }) {
  if (data.error) return <ErrorNote msg={data.error} />;
  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap text-sm text-foreground">{data.summary}</p>
      {data.keyPoints?.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {data.keyPoints.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ExplanationDisplay({
  data,
}: {
  data: { explanation?: string; nextTopics?: string[]; error?: string };
}) {
  if (data.error) return <ErrorNote msg={data.error} />;
  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap text-sm text-foreground">{data.explanation}</p>
      {data.nextTopics?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {data.nextTopics.map((t, i) => (
            <span key={i} className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs text-accent">
              {t}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ExampleDisplay({
  data,
}: {
  data: { problem?: string; solution?: string; correct_answer?: string; error?: string };
}) {
  const [show, setShow] = useState(false);
  if (data.error) return <ErrorNote msg={data.error} />;
  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap text-sm font-medium text-foreground">{data.problem}</p>
      {!show ? (
        <button
          onClick={() => setShow(true)}
          className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
        >
          Show solution
        </button>
      ) : (
        <div className="space-y-1 rounded-lg bg-muted px-3 py-2 text-sm">
          <p className="whitespace-pre-wrap">{data.solution}</p>
          {data.correct_answer && (
            <p className="font-medium text-success">Answer: {data.correct_answer}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function AnswerDisplay({ data }: { data: { answer?: string; feedback?: string; error?: string } }) {
  if (data.error) return <ErrorNote msg={data.error} />;
  return (
    <div className="space-y-1">
      <p className="whitespace-pre-wrap text-sm text-foreground">{data.answer ?? data.feedback}</p>
      {data.answer && data.feedback ? (
        <p className="text-xs text-muted-foreground">{data.feedback}</p>
      ) : null}
    </div>
  );
}

export function FormatBoardDisplay({ data }: { data: { blocks?: string[]; error?: string } }) {
  if (data.error) return <ErrorNote msg={data.error} />;
  return (
    <div className="space-y-1.5">
      {(data.blocks ?? []).map((b, i) => (
        <div key={i} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
          {b}
        </div>
      ))}
    </div>
  );
}
