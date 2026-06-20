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
  unit_id: string | null;
  subject: string;
  language: string;
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
  | "format_board"
  | "fact"
  | "list"
  | "numerical"
  | "image"
  | "chemistry";

export interface FactData {
  fact?: string;
  source?: string | null;
  error?: string;
}

export interface ListData {
  title?: string;
  items?: string[];
  error?: string;
}

export interface NumericalData {
  problem?: string;
  answer?: number | string;
  unit?: string | null;
  tolerance?: number | null;
  reasoning?: string;
  error?: string;
}

export interface ImageData {
  prompt?: string;
  imageUrl?: string | null;
  note?: string;
  error?: string;
}

export interface ChemistryData {
  name?: string;
  smiles?: string | null;
  imageUrl?: string | null;
  cid?: number | null;
  caption?: string;
  note?: string;
  error?: string;
}

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
