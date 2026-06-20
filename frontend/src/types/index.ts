// Shared types mirroring the backend contracts.

export type UserRole = "teacher" | "student" | "admin";
export type SessionStatus = "active" | "paused" | "completed";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}

export interface Session {
  id: string;
  teacher_id: string;
  subject: string;
  join_code: string;
  status: SessionStatus;
  active_buffer_tokens: number;
  start_time: string;
  end_time: string | null;
  created_at: string;
}

export type AIResponseType =
  | "quiz"
  | "summary"
  | "explanation"
  | "example"
  | "diagram"
  | "answer"
  | "format_board";

export interface AIResponse {
  type: AIResponseType;
  data: unknown;
  commandId?: string;
  command?: string;
  processingTime?: number;
  timestamp?: string;
}

export interface TranscriptEntry {
  id: string;
  text: string;
  interim?: boolean;
  starred?: boolean;
  timestamp: string;
}

export interface CompressionStatus {
  status: "started" | "complete";
  tokens?: number;
  segmentNum?: number;
  message?: string;
}
