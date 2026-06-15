"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuthStore } from "@/store/authStore";

/** Redirect to /auth/login if not authenticated. Returns true once auth is confirmed. */
export function useRequireAuth(): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // zustand/persist rehydrates synchronously from localStorage on the client.
    if (useAuthStore.getState().isAuthenticated) {
      setReady(true);
    } else {
      router.replace("/auth/login");
    }
  }, [router]);

  return ready;
}
