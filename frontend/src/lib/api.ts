import axios, { AxiosInstance, AxiosError } from 'axios'
import type { 
  User, 
  Session, 
  Quiz, 
  LoginCredentials, 
  SignupData, 
  AuthTokens,
  APIError 
} from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

class APIClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api`,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })

    this.client.interceptors.request.use(
      (config) => {
        const tokens = this.getTokens()
        if (tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.clearTokens()
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login'
          }
        }
        return Promise.reject(this.handleError(error))
      }
    )
  }

  private getTokens(): AuthTokens | null {
    if (typeof window === 'undefined') return null
    const stored = localStorage.getItem('aura-auth-storage')
    if (!stored) return null
    try {
      const parsed = JSON.parse(stored)
      return parsed.state?.tokens || null
    } catch {
      return null
    }
  }

  private clearTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aura-auth-storage')
    }
  }

  private handleError(error: AxiosError): APIError {
    if (error.response) {
      return {
        message: (error.response.data as any)?.message || 'An error occurred',
        code: (error.response.data as any)?.code,
        details: error.response.data,
      }
    }
    if (error.request) {
      return {
        message: 'No response from server. Please check your connection.',
        code: 'NETWORK_ERROR',
      }
    }
    return {
      message: error.message || 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    }
  }

  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await this.client.post('/auth/login', credentials)
    return response.data
  }

  async signup(data: SignupData): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await this.client.post('/auth/signup', data)
    return response.data
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get('/auth/me')
    return response.data
  }

  async refreshToken(): Promise<AuthTokens> {
    const response = await this.client.post('/auth/refresh')
    return response.data
  }

  async createSession(subject: string): Promise<Session> {
    const response = await this.client.post('/sessions', { subject })
    return response.data
  }

  async getSession(sessionId: string): Promise<Session> {
    const response = await this.client.get(`/sessions/${sessionId}`)
    return response.data
  }

  async getSessions(page: number = 1, pageSize: number = 20) {
    const response = await this.client.get('/sessions', {
      params: { page, page_size: pageSize },
    })
    return response.data
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    const response = await this.client.patch(`/sessions/${sessionId}`, updates)
    return response.data
  }

  async endSession(sessionId: string): Promise<Session> {
    const response = await this.client.post(`/sessions/${sessionId}/end`)
    return response.data
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.delete(`/sessions/${sessionId}`)
  }

  async exportSession(sessionId: string, format: 'pdf' | 'json' = 'pdf'): Promise<Blob> {
    const response = await this.client.get(`/sessions/${sessionId}/export`, {
      params: { format },
      responseType: 'blob',
    })
    return response.data
  }

  async getQuiz(shareCode: string): Promise<Quiz> {
    const response = await this.client.get(`/quiz/${shareCode}`)
    return response.data
  }

  async getSessionCommands(sessionId: string) {
    const response = await this.client.get(`/sessions/${sessionId}/commands`)
    return response.data
  }

  async getSessionTranscripts(sessionId: string): Promise<{ id: string; text: string; timestamp: string }[]> {
    const response = await this.client.get(`/sessions/${sessionId}/transcripts`)
    return response.data
  }

  async validateAnswer(
    sessionId: string,
    problem: string,
    correctAnswer: string,
    userAnswer: string,
  ): Promise<{ isCorrect: boolean; feedback: string }> {
    const response = await this.client.post(`/sessions/${sessionId}/validate-answer`, {
      problem,
      correct_answer: correctAnswer,
      user_answer: userAnswer,
    })
    return response.data
  }
}

export const api = new APIClient()
