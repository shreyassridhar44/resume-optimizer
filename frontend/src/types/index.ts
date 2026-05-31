// ── Analysis Types ────────────────────────────────────────────────────────────

export interface ATSResult {
  score: number
  matched_keywords: string[]
  missing_keywords: string[]
  total_jd_keywords: number
  keyword_density: number
}

export interface RecruiterFeedback {
  score: number
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  persona?: PersonaType
}

export interface RewrittenBullet {
  original: string
  improved: string
}

export interface AnalysisResult {
  analysis_id: string
  ats: ATSResult
  recruiter: RecruiterFeedback
  rewritten_bullets: RewrittenBullet[]
  created_at: string
}

export interface AnalysisResponse {
  success: boolean
  data: AnalysisResult
}

// ── Upload Types ──────────────────────────────────────────────────────────────

export interface ResumeUploadResponse {
  resume_id: string
  file_url: string
  parsed_text: string
  message: string
}

// ── History Types ─────────────────────────────────────────────────────────────

export interface HistoryItem {
  analysis_id: string
  resume_id: string
  jd_preview: string
  ats_score: number
  recruiter_score: number
  created_at: string
}

export interface HistoryResponse {
  items: HistoryItem[]
  total: number
}

// ── Form State ────────────────────────────────────────────────────────────────

export type RoleType = 'general' | 'sde' | 'ml' | 'analyst'

export type PersonaType = 'standard' | 'faang' | 'startup' | 'hr'

export type CoverLetterTone = 'professional' | 'enthusiastic' | 'concise'

export interface CoverLetterResponse {
  cover_letter: string
  tone: CoverLetterTone
}

export interface AnalyzeFormState {
  resumeId: string | null
  jobDescription: string
  roleType: RoleType
  persona: PersonaType
  file: File | null
}

// ── UI State ──────────────────────────────────────────────────────────────────

export type LoadingStep =
  | 'idle'
  | 'uploading'
  | 'parsing'
  | 'ats'
  | 'recruiter'
  | 'rewriting'
  | 'saving'
  | 'done'
  | 'error'
