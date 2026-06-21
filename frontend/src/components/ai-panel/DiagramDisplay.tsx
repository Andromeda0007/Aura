"use client";

import { RefreshCw } from "lucide-react";
import mermaid from "mermaid";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

export function DiagramDisplay({
  data,
  onRegenerate,
}: {
  data: { mermaid?: string; title?: string; kind?: string; error?: string };
  onRegenerate?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const src = data.mermaid?.trim();
    if (!src || !ref.current) return;
    let active = true;
    mermaid.initialize({
      startOnLoad: false,
      theme: resolvedTheme === "dark" ? "dark" : "default",
      securityLevel: "strict", // sanitizes — no script injection from model output
      // Render labels as native SVG <text>, not <foreignObject>: keeps the SVG
      // exportable to a canvas (foreignObject taints it) so it can be dragged onto
      // the whiteboard and captured in snapshots.
      flowchart: { htmlLabels: false },
    });
    const id = "m" + Math.random().toString(36).slice(2);

    (async () => {
      try {
        // Validate first so a bad diagram never throws into an error DOM bomb.
        const ok = await mermaid.parse(src, { suppressErrors: true });
        if (!ok) throw new Error("invalid mermaid");
        const { svg } = await mermaid.render(id, src);
        if (active && ref.current) {
          ref.current.innerHTML = svg;
          setFailed(false);
        }
      } catch {
        if (active) setFailed(true);
        // Mermaid may leave an orphaned error node on document.body — clean it up.
        document.getElementById("d" + id)?.remove();
        document.getElementById(id)?.remove();
      }
    })();

    return () => {
      active = false;
    };
  }, [data.mermaid, resolvedTheme]);

  if (data.error) return <p className="text-sm text-danger">{data.error}</p>;

  return (
    <div className="space-y-2">
      {data.title && <p className="text-sm font-medium">{data.title}</p>}
      {failed ? (
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-sm font-medium">Couldn&apos;t render this diagram</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The generated chart had invalid syntax.
            {onRegenerate ? " Try regenerating it." : " You can view the source below."}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-transform active:scale-[0.98]"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
              </button>
            )}
          </div>
          {data.mermaid && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">View source</summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-background p-3 text-xs text-muted-foreground">
                {data.mermaid}
              </pre>
            </details>
          )}
        </div>
      ) : (
        <div ref={ref} className="overflow-x-auto rounded-xl border border-border bg-white p-3" />
      )}
    </div>
  );
}
