"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";

import { ErrorNote } from "@/components/ai-panel/displays";
import { checkNumericAnswer } from "@/lib/response-checks";
import type { NumericalData } from "@/types";

export function NumericalDisplay({ data }: { data: NumericalData }) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);

  if (data.error) return <ErrorNote msg={data.error} />;

  const expected = `${data.answer ?? ""}${data.unit ? ` ${data.unit}` : ""}`.trim();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setCorrect(checkNumericAnswer(value, data).correct);
    setChecked(true);
  }

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap text-sm font-medium text-foreground">{data.problem}</p>

      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setChecked(false);
          }}
          inputMode="decimal"
          placeholder={data.unit ? `Your answer (${data.unit})` : "Your answer"}
          className="h-9 flex-1 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          Check
        </button>
      </form>

      {checked && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            correct
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
        >
          {correct ? <Check className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}
          <span>
            {correct ? "Correct!" : "Not quite."}
            {!correct && expected ? ` Answer: ${expected}` : ""}
          </span>
        </div>
      )}

      {checked && data.reasoning && (
        <div className="space-y-1 rounded-lg bg-muted px-3 py-2 text-sm">
          <p className="text-xs font-medium text-muted-foreground">Solution</p>
          <p className="whitespace-pre-wrap">{data.reasoning}</p>
        </div>
      )}

      {checked && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            setChecked(false);
          }}
          className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
        >
          Try again
        </button>
      )}
    </div>
  );
}
