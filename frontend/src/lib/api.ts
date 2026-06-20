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
  login: (body: { email: string; password: string }) =>
    api.post<AuthResponse>("/auth/login", body).then((r) => r.data),
  me: () => api.get<User>("/auth/me").then((r) => r.data),
  updateProfile: (full_name: string) =>
    api.patch<User>("/auth/me", { full_name }).then((r) => r.data),
};

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "teacher" | "student";
  isActive: boolean;
  batchIds: string[];
  createdAt: string | null;
}
export interface AdminStats {
  batches: {
    id: string;
    program: string;
    semester: number;
    year: number;
    section: string | null;
    members: number;
    sessions: number;
    quizzes: number;
    tokensUsed: number;
  }[];
  totals: { batches: number; courses: number; sessions: number; quizzes: number; tokensUsed: number };
}

export const adminApi = {
  listUsers: () => api.get<AdminUser[]>("/admin/users").then((r) => r.data),
  createUser: (body: {
    email: string;
    full_name: string;
    password: string;
    role: string;
    batch_ids: string[];
  }) => api.post<AdminUser>("/admin/users", body).then((r) => r.data),
  updateUser: (
    id: string,
    body: Partial<{ full_name: string; password: string; is_active: boolean; role: string; batch_ids: string[] }>,
  ) => api.patch<AdminUser>(`/admin/users/${id}`, body).then((r) => r.data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`).then(() => undefined),
  stats: () => api.get<AdminStats>("/admin/stats").then((r) => r.data),
};

export const sessionApi = {
  create: (subject: string, unitId?: string | null) =>
    api.post<Session>("/sessions", { subject, unit_id: unitId ?? null }).then((r) => r.data),
  setLanguage: (id: string, language: string) =>
    api.patch<Session>(`/sessions/${id}`, { language }).then((r) => r.data),
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
  report: (id: string) => api.get<SessionReport>(`/sessions/${id}/report`).then((r) => r.data),
  starTranscript: (sessionId: string, transcriptId: string, starred: boolean) =>
    api
      .patch(`/sessions/${sessionId}/transcripts/${transcriptId}/star`, { starred })
      .then((r) => r.data),
};

export interface SessionReport {
  subject: string;
  status: string;
  date: string | null;
  durationMin: number | null;
  summary: string;
  keyPoints: string[];
  keyConcepts: string[];
  highlights: string[];
  quizzes: { shareCode: string; questionCount: number; attempts: number; avgPct: number }[];
  stats: { commands: number; transcripts: number };
}

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

export interface StatsDeep {
  bySubject: { subject: string; sessions: number; commands: number; attempts: number; avgPct: number }[];
  quizPerformance: { quizId: string; subject: string; attempts: number; avgPct: number }[];
  hardestConcepts: { subject: string; question: string; missRate: number; attempts: number }[];
}

export const statsApi = {
  overview: () => api.get<StatsOverview>("/stats/overview").then((r) => r.data),
  activity: () => api.get<StatsActivity>("/stats/activity").then((r) => r.data),
  deep: () => api.get<StatsDeep>("/stats/deep").then((r) => r.data),
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
  ask: (code: string, question: string) =>
    api.post<{ answer: string }>(`/live/${code}/ask`, { question }).then((r) => r.data),
};

// ---- Academic hierarchy: Batch -> Course -> Unit -> Session ----
export interface Batch {
  id: string;
  program: string;
  semester: number;
  year: number;
  section: string | null;
  roster: { name: string }[];
  archived: boolean;
  created_at: string;
}
export interface BatchSummary {
  id: string;
  program: string;
  semester: number;
  year: number;
  section: string | null;
  archived: boolean;
  courses: number;
  sessions: number;
  tokensUsed: number;
  createdAt: string | null;
}

export interface Course {
  id: string;
  batch_id: string;
  name: string;
  professor: string;
  cover: string;
  color: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}
export interface CourseSummary extends Course {
  units: number;
  sessions: number;
  tokensUsed: number;
  items: number;
}
export interface Unit {
  id: string;
  course_id: string;
  name: string;
  description: string;
  order: number;
  created_at: string;
}
export interface CourseDetail {
  course: Course;
  counts: { sessions: number; tokensUsed: number; items: number };
  units: (Unit & { sessions: number })[];
}
export interface UnitDetail {
  unit: Unit;
  sessions: Session[];
}

export interface LevelStats {
  totalSessions: number;
  totalCommands: number;
  totalQuizzes: number;
  totalTranscripts: number;
  avgLatencyMs: number;
  tokensUsed: number;
  intentMix: Record<string, number>;
  hardestConcepts: { question: string; missRate: number }[];
}

export interface AssignmentSummary {
  id: string;
  title: string;
  shareCode: string;
  hasQuiz: boolean;
  dueAt: string | null;
  submissions: number;
  createdAt: string | null;
}
export interface AssignmentSubmissions {
  title: string;
  hasQuiz: boolean;
  submissions: { name: string; score: number; total: number; at: string | null }[];
  notSubmitted: string[];
}
export interface PublicAssignment {
  title: string;
  instructions: string;
  dueAt: string | null;
  quizData: { questions: unknown[] } | null;
}

export const assignmentApi = {
  list: () => api.get<AssignmentSummary[]>("/assignments").then((r) => r.data),
  create: (body: { title: string; instructions?: string; quiz_id?: string | null; course_id?: string | null; due_at?: string | null }) =>
    api.post<{ id: string; shareCode: string }>("/assignments", body).then((r) => r.data),
  submissions: (id: string) =>
    api.get<AssignmentSubmissions>(`/assignments/${id}/submissions`).then((r) => r.data),
};

export const toolsApi = {
  differentiate: (content: string, level: string) =>
    api.post("/tools/differentiate", { content, level }).then((r) => r.data),
  lessonPlan: (topic: string, grade: string, minutes: number) =>
    api.post("/tools/lesson-plan", { topic, grade, minutes }).then((r) => r.data),
  worksheet: (topic: string, count: number) =>
    api.post("/tools/worksheet", { topic, count }).then((r) => r.data),
  rubric: (assignment: string) => api.post("/tools/rubric", { assignment }).then((r) => r.data),
  grade: (question: string, guidance: string, response: string) =>
    api.post("/tools/grade", { question, guidance, response }).then((r) => r.data),
  standards: (content: string) => api.post("/tools/standards", { content }).then((r) => r.data),
};

export const batchApi = {
  list: () => api.get<BatchSummary[]>("/batches").then((r) => r.data),
  get: (id: string) => api.get<Batch>(`/batches/${id}`).then((r) => r.data),
  create: (body: { program: string; semester: number; year: number; section?: string | null }) =>
    api.post<Batch>("/batches", body).then((r) => r.data),
  update: (
    id: string,
    body: Partial<{ program: string; semester: number; year: number; section: string | null; roster: { name: string }[]; archived: boolean }>,
  ) => api.patch<Batch>(`/batches/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/batches/${id}`).then(() => undefined),
  stats: (id: string) => api.get<LevelStats>(`/batches/${id}/stats`).then((r) => r.data),
};

export const courseApi = {
  list: (batchId: string) =>
    api.get<CourseSummary[]>(`/courses?batch_id=${batchId}`).then((r) => r.data),
  get: (id: string) => api.get<CourseDetail>(`/courses/${id}`).then((r) => r.data),
  create: (body: {
    batch_id: string;
    name: string;
    professor?: string;
    cover?: string;
    color?: string;
    start_date?: string | null;
    end_date?: string | null;
  }) => api.post<Course>("/courses", body).then((r) => r.data),
  update: (id: string, body: Partial<Omit<Course, "id" | "batch_id" | "created_at">>) =>
    api.patch<Course>(`/courses/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/courses/${id}`).then(() => undefined),
  stats: (id: string) => api.get<LevelStats>(`/courses/${id}/stats`).then((r) => r.data),
};

export const unitApi = {
  get: (id: string) => api.get<UnitDetail>(`/units/${id}`).then((r) => r.data),
  create: (body: { course_id: string; name: string; description?: string; order?: number }) =>
    api.post<Unit>("/units", body).then((r) => r.data),
  update: (id: string, body: Partial<{ name: string; description: string; order: number }>) =>
    api.patch<Unit>(`/units/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/units/${id}`).then(() => undefined),
  stats: (id: string) => api.get<LevelStats>(`/units/${id}/stats`).then((r) => r.data),
};

