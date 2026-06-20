"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import { CommandPalette } from "@/components/command/CommandPalette";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
      <CommandPalette />
      <Toaster richColors closeButton position="top-center" />
    </ThemeProvider>
  );
}
