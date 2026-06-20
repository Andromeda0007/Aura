"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Password field with a show/hide eye toggle (catch spelling mistakes). */
export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          {...props}
          type={show ? "text" : "password"}
          className={cn("pr-11", className)}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
