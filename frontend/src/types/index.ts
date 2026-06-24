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

export interface JDIntelligence {
  role_summary: string
  required_skills: string[]
  nice_to_have_skills: string[]
  experience_level: string
  key_responsibilities: string[]
  education: string
}

export interface StrengthMetric {
  score: number
  rationale: string
}

export interface StrengthBreakdown {
  skill_match: StrengthMetric
  experience_relevance: StrengthMetric
  project_depth: StrengthMetric
  keyword_coverage: StrengthMetric
  impact_score: StrengthMetric
  structure_score: StrengthMetric
  overall: number
}

export interface SemanticMatch {
  score: number
  interpretation: string
  embedding_dimensions: number
  raw_similarity: number
  keyword_score: number
  score_difference: number
}

export interface AnalysisResult {
  analysis_id: string
  resume_id?: string
  ats: ATSResult
  recruiter: RecruiterFeedback
  rewritten_bullets: RewrittenBullet[]
  jd_intelligence?: JDIntelligence | null
  strength_breakdown?: StrengthBreakdown | null
  semantic_match?: SemanticMatch | null
  resume_text?: string
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

// ── Skill Gap Roadmap ─────────────────────────────────────────────────────────

export type SkillPriority = 'high' | 'medium' | 'low'

export interface SkillGapItem {
  skill: string
  priority: SkillPriority
  reason: string
  learning_path: string[]
  estimated_time: string
}

export interface SkillGapRoadmap {
  summary: string
  readiness_score: number
  matched_skills: string[]
  missing_skills: SkillGapItem[]
}

export interface SkillGapResponse {
  roadmap: SkillGapRoadmap
}

// ── Live Feedback (Real-Time Editing) ─────────────────────────────────────────

export type LiveTipType = 'good' | 'warning' | 'info'

export interface LiveTip {
  type: LiveTipType
  message: string
}

export interface LiveFeedbackResponse {
  overall_score: number
  ats_score: number
  impact_score: number
  structure_score: number
  matched_keywords: string[]
  missing_keywords: string[]
  word_count: number
  tips: LiveTip[]
}

// ── Red Flag Detection ────────────────────────────────────────────────────────

export type RedFlagCategory = 'buzzword' | 'metrics' | 'gap' | 'weak_verbs' | 'tech_overload' | 'length' | 'structure'
export type RedFlagSeverity = 'critical' | 'warning' | 'info'

export interface RedFlag {
  category: RedFlagCategory
  severity: RedFlagSeverity
  message: string
  details?: string
}

export interface RedFlagReport {
  flags: RedFlag[]
  total_count: number
  severity_breakdown: {
    critical: number
    warning: number
    info: number
  }
}

export interface RedFlagResponse {
  report: RedFlagReport
}

// ── Resume Evolution Tracker ──────────────────────────────────────────────────

export interface VersionSnapshot {
  analysis_id: string
  version_number: number
  ats_score: number
  recruiter_score: number
  created_at: string
  jd_preview?: string
}

export interface EvolutionTimeline {
  resume_id: string
  total_versions: number
  first_score: number
  latest_score: number
  improvement: number
  versions: VersionSnapshot[]
}

export interface EvolutionResponse {
  timeline: EvolutionTimeline
}

export interface VersionComparison {
  version1: VersionSnapshot
  version2: VersionSnapshot
  score_diff: number
  recruiter_diff: number
  keyword_changes: {
    added: string[]
    removed: string[]
  }
}

export interface CompareResponse {
  comparison: VersionComparison
}

// ── Form State ────────────────────────────────────────────────────────────────

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
