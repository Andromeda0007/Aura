import { useAuthStore } from "@/store/authStore";
import type { UserRole } from "@/types";

export function useRole(): UserRole | undefined {
  return useAuthStore((s) => s.user?.role);
}

/** Admin + teacher can create/run; students are read-only. */
export function useCanWrite(): boolean {
  const role = useRole();
  return role === "admin" || role === "teacher";
}

export function useIsAdmin(): boolean {
  return useRole() === "admin";
}
