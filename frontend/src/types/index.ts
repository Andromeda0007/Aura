export interface User {
  id: string
  email: string
  fullName: string
  role: 'teacher' | 'student' | 'admin'
  createdAt: string
  isActive: boolean
}

export interface Session {
  id: string
  teacherId: string
  subject: string
  status: 'active' | 'paused' | 'completed'
  startTime: string
  endTime?: string
  compressedHistory: CompressedSegment[]
  activeBufferTokens: number
  metadata?: SessionMetadata
}

export interface SessionMetadata {
  smartboardModel?: string
  roomNumber?: string
  tags?: string[]
}

export interface CompressedSegment {
  segmentNum: number
  timeRange: string
  tokenCount: number
  compressionMethod: 'llm' | 'fallback'
  summary: {
    topicFlow: string[]
    keyConcepts: Record<string, string>
    visualReferences: VisualReference[]
    dependencies: string[]
  }
}

export interface VisualReference {
  timestamp: string
  content: string
  type?: 'diagram' | 'equation' | 'text' | 'code'
}

export interface Transcript {
  id: string
  sessionId: string
  text: string
  timestamp: string
  confidence: number
  isProcessed: boolean
}

export interface WhiteboardLog {
  id: string
  sessionId: string
  tldrawSnapshot: any
  imageUrl: string
  ocrText: string
  timestamp: string
  pageNumber: number
}

export interface Command {
  id: string
  sessionId: string
  rawCommand: string
  intent: CommandIntent
  llmResponse: any
  status: 'pending' | 'processing' | 'completed' | 'failed'
  processingTimeMs?: number
  timestamp: string
}

export type CommandIntent = 
  | 'generate_quiz' 
  | 'summarize' 
  | 'explain' 
  | 'generate_example' 
  | 'answer_question'
  | 'other'

export interface Quiz {
  id: string
  sessionId: string
  commandId: string
  shareCode: string
  quizData: QuizData
  createdAt: string
  expiresAt?: string
}

export interface QuizData {
  title: string
  questions: QuizQuestion[]
  timeLimit?: number
}

export interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: number
  explanation?: string
}


export interface WSMessage {
  type: WSMessageType
  data: any
  timestamp: string
}

export type WSMessageType =
  | 'audio_chunk'
  | 'canvas_snapshot'
  | 'voice_command'
  | 'transcript_text'
  | 'transcript_update'
  | 'compression_started'
  | 'compression_complete'
  | 'command_processing'
  | 'command_response'
  | 'error'
  | 'session_ended'
  | 'ping'
  | 'pong'

export interface AudioChunk {
  sessionId: string
  data: string
  timestamp: string
  chunkId: number
}

export interface CanvasSnapshot {
  sessionId: string
  tldrawState: any
  imageData: string
  timestamp: string
  pageNumber: number
}

export interface VoiceCommand {
  sessionId: string
  command: string
  timestamp: string
}

export interface AIResponse {
  type: 'quiz' | 'summary' | 'explanation' | 'example' | 'answer' | 'diagram'
  data: any
  commandId: string
  command: string
  processingTime: number
  timestamp: string
}

export interface DiagramData {
  diagramType: 'mermaid' | 'chemistry'
  title: string
  description?: string
  // mermaid
  code?: string
  // chemistry
  compoundName?: string
  smiles?: string
}

export interface ExampleData {
  title: string
  problem: string
  correctAnswer: string
  explanation: string
}

export interface ValidateAnswerResult {
  isCorrect: boolean
  feedback: string
}

export interface CompressionNotification {
  message: string
  segmentNum: number
  method: 'llm' | 'fallback'
  status: 'started' | 'complete' | 'failed'
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
  expiresIn: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignupData {
  email: string
  password: string
  fullName: string
  role: 'teacher' | 'student'
}

export interface APIError {
  message: string
  code?: string
  details?: any
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface SessionSummary {
  sessionId: string
  subject: string
  duration: number
  totalTranscripts: number
  totalDrawings: number
  commandsExecuted: number
  topics: string[]
  keyMoments: KeyMoment[]
}

export interface KeyMoment {
  timestamp: string
  type: 'topic_change' | 'quiz_generated' | 'question_asked' | 'important_concept'
  description: string
}
