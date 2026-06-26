import type {
  ResumeUploadResponse,
  AnalysisResponse,
  HistoryResponse,
  RoleType,
  PersonaType,
  CoverLetterTone,
  CoverLetterResponse,
  SkillGapResponse,
  LiveFeedbackResponse,
  RedFlagResponse,
  EvolutionResponse,
  CompareResponse,
} from '../types'
import { supabase } from '../lib/supabase'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Helper to get auth headers with JWT token
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please log in.')
  }
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const err = await res.json()
      msg = err.detail || err.message || msg
    } catch {
      //
    }
    throw new Error(msg)
  }
  return res.json()
}

// ── Resume ────────────────────────────────────────────────────────────────────

export async function uploadResume(file: File): Promise<ResumeUploadResponse> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }

  const fd = new FormData()
  fd.append('file', file)
  // user_id removed - backend gets it from JWT token

  const res = await fetch(`${BASE_URL}/upload-resume`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: fd,
  })
  return handleResponse<ResumeUploadResponse>(res)
}

// ── Analysis ──────────────────────────────────────────────────────────────────

export async function analyzeResume(params: {
  resumeId: string
  jobDescription: string
  roleType: RoleType
  persona: PersonaType
}): Promise<AnalysisResponse> {
  const headers = await getAuthHeaders()

  const res = await fetch(`${BASE_URL}/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      resume_id: params.resumeId,
      job_description: params.jobDescription,
      // user_id removed - comes from JWT token
      role_type: params.roleType,
      persona: params.persona,
    }),
  })
  return handleResponse<AnalysisResponse>(res)
}

export async function getAnalysis(analysisId: string): Promise<AnalysisResponse['data']> {
  const headers = await getAuthHeaders()

  const res = await fetch(`${BASE_URL}/analysis/${analysisId}`, {
    headers,
  })
  return handleResponse<AnalysisResponse['data']>(res)
}

// ── Cover Letter ────────────────────────────────────────────────────────────

export async function generateCoverLetter(params: {
  analysisId: string
  tone: CoverLetterTone
  applicantName?: string
  companyName?: string
  roleTitle?: string
}): Promise<CoverLetterResponse> {
  const headers = await getAuthHeaders()

  const res = await fetch(`${BASE_URL}/cover-letter`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      analysis_id: params.analysisId,
      // user_id removed - comes from JWT token
      tone: params.tone,
      applicant_name: params.applicantName ?? '',
      company_name: params.companyName ?? '',
      role_title: params.roleTitle ?? '',
    }),
  })
  return handleResponse<CoverLetterResponse>(res)
}

// ── Skill Gap Roadmap ───────────────────────────────────────────────────────

export async function generateSkillGapRoadmap(params: {
  analysisId: string
}): Promise<SkillGapResponse> {
  const headers = await getAuthHeaders()

  const res = await fetch(`${BASE_URL}/skill-gap`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      analysis_id: params.analysisId,
      // user_id removed - comes from JWT token
    }),
  })
  return handleResponse<SkillGapResponse>(res)
}

// ── Live Feedback ───────────────────────────────────────────────────────────

export async function getLiveFeedback(
  params: { resumeText: string; jobDescription: string },
  signal?: AbortSignal
): Promise<LiveFeedbackResponse> {
  const res = await fetch(`${BASE_URL}/live-feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resume_text: params.resumeText,
      job_description: params.jobDescription,
    }),
    signal,
  })
  return handleResponse<LiveFeedbackResponse>(res)
}

// ── Red Flag Detection ───────────────────────────────────────────────────────

export async function detectRedFlags(
  resumeText: string,
  signal?: AbortSignal
): Promise<RedFlagResponse> {
  const res = await fetch(`${BASE_URL}/red-flags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resume_text: resumeText,
    }),
    signal,
  })
  return handleResponse<RedFlagResponse>(res)
}

// ── Resume Evolution ──────────────────────────────────────────────────────────

export async function getResumeEvolution(resumeId: string): Promise<EvolutionResponse> {
  const headers = await getAuthHeaders()

  const res = await fetch(`${BASE_URL}/evolution/${resumeId}`, {
    headers,
  })
  return handleResponse<EvolutionResponse>(res)
}

export async function compareVersions(
  v1: string,
  v2: string
): Promise<CompareResponse> {
  const headers = await getAuthHeaders()

  const res = await fetch(
    `${BASE_URL}/evolution/compare?v1=${v1}&v2=${v2}`,
    { headers }
  )
  return handleResponse<CompareResponse>(res)
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getUserHistory(limit = 20): Promise<HistoryResponse> {
  const headers = await getAuthHeaders()

  const res = await fetch(`${BASE_URL}/history?limit=${limit}`, {
    headers,
  })
  return handleResponse<HistoryResponse>(res)
}

export async function deleteAnalysis(analysisId: string): Promise<void> {
  const headers = await getAuthHeaders()

  const res = await fetch(`${BASE_URL}/history/${analysisId}`, {
    method: 'DELETE',
    headers,
  })
  return handleResponse<void>(res)
}

// ── AI Resume Auto-Editor ─────────────────────────────────────────────────────

export async function getAutoEditSuggestions(params: {
  analysisId: string
  maxSuggestions?: number
}): Promise<import('../types').AutoEditSuggestionsResponse> {
  const headers = await getAuthHeaders()

  const res = await fetch(`${BASE_URL}/auto-edit-suggestions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      analysis_id: params.analysisId,
      // user_id removed - comes from JWT token
      max_suggestions: params.maxSuggestions ?? 10,
    }),
  })
  return handleResponse<import('../types').AutoEditSuggestionsResponse>(res)
}

export async function applyResumeEdits(params: {
  analysisId: string
  resumeText: string
  appliedSuggestions: import('../types').EditSuggestion[]
  format: 'pdf' | 'docx' | 'both'
}): Promise<import('../types').ApplyEditsResponse> {
  const headers = await getAuthHeaders()

  const res = await fetch(`${BASE_URL}/apply-edits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      analysis_id: params.analysisId,
      resume_text: params.resumeText,
      applied_suggestions: params.appliedSuggestions,
      format: params.format,
      // user_id removed - comes from JWT token
    }),
  })
  return handleResponse<import('../types').ApplyEditsResponse>(res)
}