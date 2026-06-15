"use client";

import mermaid from "mermaid";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

export function DiagramDisplay({
  data,
}: {
  data: { mermaid?: string; title?: string; error?: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const src = data.mermaid;
    if (!src || !ref.current) return;
    let active = true;
    mermaid.initialize({
      startOnLoad: false,
      theme: resolvedTheme === "dark" ? "dark" : "default",
      securityLevel: "strict", // sanitizes — no script injection from model output
    });
    const id = "m" + Math.random().toString(36).slice(2);
    mermaid
      .render(id, src)
      .then(({ svg }) => {
        if (active && ref.current) {
          ref.current.innerHTML = svg;
          setFailed(false);
        }
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [data.mermaid, resolvedTheme]);

  if (data.error) return <p className="text-sm text-danger">{data.error}</p>;

  return (
    <div className="space-y-2">
      {data.title && <p className="text-sm font-medium">{data.title}</p>}
      {failed ? (
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          {data.mermaid}
        </pre>
      ) : (
        <div ref={ref} className="overflow-x-auto rounded-xl border border-border bg-white p-3" />
      )}
    </div>
  );
}
