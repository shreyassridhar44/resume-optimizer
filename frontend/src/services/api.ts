import type {
  ResumeUploadResponse,
  AnalysisResponse,
  HistoryResponse,
  RoleType,
  PersonaType,
  CoverLetterTone,
  CoverLetterResponse,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

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

export async function uploadResume(
  file: File,
  userId: string
): Promise<ResumeUploadResponse> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('user_id', userId)

  const res = await fetch(`${BASE_URL}/upload-resume`, {
    method: 'POST',
    body: fd,
  })
  return handleResponse<ResumeUploadResponse>(res)
}

// ── Analysis ──────────────────────────────────────────────────────────────────

export async function analyzeResume(params: {
  resumeId: string
  jobDescription: string
  userId: string
  roleType: RoleType
  persona: PersonaType
}): Promise<AnalysisResponse> {
  const res = await fetch(`${BASE_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resume_id: params.resumeId,
      job_description: params.jobDescription,
      user_id: params.userId,
      role_type: params.roleType,
      persona: params.persona,
    }),
  })
  return handleResponse<AnalysisResponse>(res)
}

export async function getAnalysis(
  analysisId: string,
  userId: string
): Promise<AnalysisResponse['data']> {
  const res = await fetch(
    `${BASE_URL}/analysis/${analysisId}?user_id=${userId}`
  )
  return handleResponse<AnalysisResponse['data']>(res)
}

// ── Cover Letter ────────────────────────────────────────────────────────────

export async function generateCoverLetter(params: {
  analysisId: string
  userId: string
  tone: CoverLetterTone
  applicantName?: string
  companyName?: string
  roleTitle?: string
}): Promise<CoverLetterResponse> {
  const res = await fetch(`${BASE_URL}/cover-letter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      analysis_id: params.analysisId,
      user_id: params.userId,
      tone: params.tone,
      applicant_name: params.applicantName ?? '',
      company_name: params.companyName ?? '',
      role_title: params.roleTitle ?? '',
    }),
  })
  return handleResponse<CoverLetterResponse>(res)
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getUserHistory(
  userId: string,
  limit = 20
): Promise<HistoryResponse> {
  const res = await fetch(
    `${BASE_URL}/history?user_id=${userId}&limit=${limit}`
  )
  return handleResponse<HistoryResponse>(res)
}

export async function deleteAnalysis(
  analysisId: string,
  userId: string
): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/history/${analysisId}?user_id=${userId}`,
    { method: 'DELETE' }
  )
  return handleResponse<void>(res)
}