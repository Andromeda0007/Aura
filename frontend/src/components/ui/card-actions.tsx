"use client";

import { Pencil, Trash2 } from "lucide-react";

/** Hover-revealed edit/delete buttons for a card. Place inside a `relative group`
 *  container; calls preventDefault+stopPropagation so it never triggers a wrapping
 *  <Link>. Gate visibility with `show` (e.g. canWrite / isAdmin). */
export function CardActions({
  onEdit,
  onDelete,
  canEdit = true,
  show = true,
}: {
  onEdit?: () => void;
  onDelete: () => void;
  canEdit?: boolean;
  show?: boolean;
}) {
  if (!show) return null;

  const handle = (fn?: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn?.();
  };

  return (
    <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
      {canEdit && onEdit && (
        <button
          type="button"
          aria-label="Edit"
          title="Edit"
          onClick={handle(onEdit)}
          className="rounded-lg border border-border bg-card/90 p-1.5 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        aria-label="Delete"
        title="Delete"
        onClick={handle(onDelete)}
        className="rounded-lg border border-border bg-card/90 p-1.5 text-muted-foreground backdrop-blur transition-colors hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
