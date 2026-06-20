import axios, { type AxiosRequestConfig } from "axios";

import { useAuthStore } from "@/store/authStore";
import type { AuthResponse, Session, TokenPair, User } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().tokens?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = useAuthStore.getState().tokens?.refresh_token;
  if (!refresh) return null;
  try {
    const { data } = await axios.post<TokenPair>(`${API_URL}/auth/refresh`, {
      refresh_token: refresh,
    });
    useAuthStore.getState().setTokens(data);
    return data.access_token;
  } catch {
    useAuthStore.getState().logout();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccessToken();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

// ---- typed API helpers ----
export const authApi = {
  signup: (body: { email: string; password: string; full_name: string; role?: string }) =>
    api.post<AuthResponse>("/auth/signup", body).then((r) => r.data),
  login: (body: { email: string; password: string }) =>
    api.post<AuthResponse>("/auth/login", body).then((r) => r.data),
  me: () => api.get<User>("/auth/me").then((r) => r.data),
  updateProfile: (full_name: string) =>
    api.patch<User>("/auth/me", { full_name }).then((r) => r.data),
  deleteAccount: () => api.delete("/auth/me").then(() => undefined),
};

export const sessionApi = {
  create: (subject: string, courseId?: string | null) =>
    api.post<Session>("/sessions", { subject, course_id: courseId ?? null }).then((r) => r.data),
  setCourse: (id: string, courseId: string | null) =>
    api.patch<Session>(`/sessions/${id}`, { course_id: courseId }).then((r) => r.data),
  list: () => api.get<Session[]>("/sessions").then((r) => r.data),
  get: (id: string) => api.get<Session>(`/sessions/${id}`).then((r) => r.data),
  end: (id: string) => api.post<Session>(`/sessions/${id}/end`).then((r) => r.data),
  history: (id: string) =>
    api
      .get<{
        transcripts: { id: string; text: string; timestamp: string }[];
        commands: { commandId: string; type: string; command: string; data: unknown }[];
      }>(`/sessions/${id}/history`)
      .then((r) => r.data),
  exportMarkdown: (id: string) =>
    api.get(`/export/${id}`, { responseType: "blob" }).then((r) => r.data as Blob),
};

export interface StatsOverview {
  totalSessions: number;
  totalCommands: number;
  totalQuizzes: number;
  totalTranscripts: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  intentMix: Record<string, number>;
}
export interface StatsActivity {
  sessionsByDay: Record<string, number>;
  commandsByDay: Record<string, number>;
}

export const statsApi = {
  overview: () => api.get<StatsOverview>("/stats/overview").then((r) => r.data),
  activity: () => api.get<StatsActivity>("/stats/activity").then((r) => r.data),
};

export interface LibraryItem {
  commandId: string;
  type: string;
  command: string;
  data: unknown;
  sessionId: string;
  subject: string;
  timestamp: string | null;
}

export const libraryApi = {
  list: () => api.get<LibraryItem[]>("/library").then((r) => r.data),
};

export interface QuizSummary {
  id: string;
  shareCode: string;
  subject: string;
  questionCount: number;
  attempts: number;
  createdAt: string | null;
}
export interface QuizResults {
  shareCode: string;
  subject: string;
  total: number;
  attempts: number;
  avgScore: number;
  mostMissed: { question: string; missRate: number }[];
  recent: { name: string; score: number; total: number; at: string | null }[];
}

export const quizApi = {
  list: () => api.get<QuizSummary[]>("/quizzes").then((r) => r.data),
  results: (id: string) => api.get<QuizResults>(`/quizzes/${id}/results`).then((r) => r.data),
};

export interface LiveSession {
  sessionId: string;
  subject: string;
  status: string;
  joinCode: string;
}

export const liveApi = {
  resolve: (code: string) => api.get<LiveSession>(`/live/${code}`).then((r) => r.data),
};

export interface CourseSummary {
  id: string;
  name: string;
  color: string;
  students: number;
  sessions: number;
  createdAt: string | null;
}
export interface Course {
  id: string;
  name: string;
  color: string;
  roster: { name: string }[];
  created_at: string;
}
export interface CourseDetail {
  course: Course;
  sessions: Session[];
}

export const courseApi = {
  list: () => api.get<CourseSummary[]>("/courses").then((r) => r.data),
  get: (id: string) => api.get<CourseDetail>(`/courses/${id}`).then((r) => r.data),
  create: (name: string, color?: string) =>
    api.post<Course>("/courses", { name, color }).then((r) => r.data),
  update: (id: string, body: { name?: string; color?: string; roster?: { name: string }[] }) =>
    api.patch<Course>(`/courses/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/courses/${id}`).then(() => undefined),
};

