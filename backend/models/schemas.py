from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
import uuid


# ── Resume ──────────────────────────────────────────────────────────────────

class ResumeUploadResponse(BaseModel):
    resume_id: str
    file_url: str
    parsed_text: str
    message: str = "Resume uploaded and parsed successfully"


class ParsedResume(BaseModel):
    raw_text: str
    skills: List[str] = []
    experience_snippets: List[str] = []
    projects: List[str] = []
    bullet_points: List[str] = []


# ── Job Description ──────────────────────────────────────────────────────────

class JobDescriptionInput(BaseModel):
    content: str = Field(..., min_length=50, description="Full job description text")
    user_id: str


# ── Analysis ─────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    resume_id: str
    job_description: str
    user_id: str
    role_type: Optional[str] = "general"  # sde | ml | analyst | general
    persona: Optional[str] = "standard"  # standard | faang | startup | hr


class ATSResult(BaseModel):
    score: float = Field(..., ge=0, le=100)
    matched_keywords: List[str]
    missing_keywords: List[str]
    total_jd_keywords: int
    keyword_density: float


class RecruiterFeedback(BaseModel):
    score: float = Field(..., ge=0, le=10)
    strengths: List[str]
    weaknesses: List[str]
    suggestions: List[str]
    persona: Optional[str] = "standard"


class JDIntelligence(BaseModel):
    role_summary: str = ""
    required_skills: List[str] = []
    nice_to_have_skills: List[str] = []
    experience_level: str = ""
    key_responsibilities: List[str] = []
    education: str = ""


class StrengthMetric(BaseModel):
    score: int = Field(0, ge=0, le=100)
    rationale: str = ""


class StrengthBreakdown(BaseModel):
    skill_match: StrengthMetric = StrengthMetric()
    experience_relevance: StrengthMetric = StrengthMetric()
    project_depth: StrengthMetric = StrengthMetric()
    keyword_coverage: StrengthMetric = StrengthMetric()
    impact_score: StrengthMetric = StrengthMetric()
    structure_score: StrengthMetric = StrengthMetric()
    overall: int = Field(0, ge=0, le=100)


class RewrittenBullet(BaseModel):
    original: str
    improved: str


class AnalysisResult(BaseModel):
    analysis_id: str
    ats: ATSResult
    recruiter: RecruiterFeedback
    rewritten_bullets: List[RewrittenBullet]
    jd_intelligence: Optional[JDIntelligence] = None
    strength_breakdown: Optional[StrengthBreakdown] = None
    semantic_match: Optional["SemanticMatch"] = None
    created_at: str


class AnalysisResponse(BaseModel):
    success: bool = True
    data: AnalysisResult


# ── Semantic Matching ────────────────────────────────────────────────────────

class SemanticMatch(BaseModel):
    score: float = Field(..., ge=0, le=100, description="Semantic similarity score 0-100")
    interpretation: str = ""
    embedding_dimensions: int = 128
    raw_similarity: float = Field(0.0, ge=0, le=1)
    keyword_score: float = 0.0  # ATS score for comparison
    score_difference: float = 0.0  # Semantic - Keyword


class SemanticMatchResponse(BaseModel):
    semantic_match: SemanticMatch


# ── Rewrite ──────────────────────────────────────────────────────────────────

class RewriteRequest(BaseModel):
    bullet_points: List[str]
    job_context: Optional[str] = ""


class RewriteResponse(BaseModel):
    rewritten: List[RewrittenBullet]


# ── Live Feedback (Real-Time Editing) ────────────────────────────────────────

class LiveFeedbackRequest(BaseModel):
    resume_text: str = ""
    job_description: str = ""


class LiveTip(BaseModel):
    type: str = "info"  # good | warning | info
    message: str


class LiveFeedbackResponse(BaseModel):
    overall_score: int = Field(0, ge=0, le=100)
    ats_score: float = Field(0, ge=0, le=100)
    impact_score: int = Field(0, ge=0, le=100)
    structure_score: int = Field(0, ge=0, le=100)
    matched_keywords: List[str] = []
    missing_keywords: List[str] = []
    word_count: int = 0
    tips: List[LiveTip] = []


# ── Cover Letter ─────────────────────────────────────────────────────────────

class CoverLetterRequest(BaseModel):
    analysis_id: str
    user_id: str
    tone: Optional[str] = "professional"  # professional | enthusiastic | concise
    applicant_name: Optional[str] = ""
    company_name: Optional[str] = ""
    role_title: Optional[str] = ""


class CoverLetterResponse(BaseModel):
    cover_letter: str
    tone: str


# ── Skill Gap Roadmap ────────────────────────────────────────────────────────

class SkillGapRequest(BaseModel):
    analysis_id: str
    user_id: str


class SkillGapItem(BaseModel):
    skill: str
    priority: str = "medium"  # high | medium | low
    reason: str = ""
    learning_path: List[str] = []
    estimated_time: str = ""


class SkillGapRoadmap(BaseModel):
    summary: str = ""
    readiness_score: int = 0  # 0-100
    matched_skills: List[str] = []
    missing_skills: List[SkillGapItem] = []


class SkillGapResponse(BaseModel):
    roadmap: SkillGapRoadmap


# ── Red Flag Detection ──────────────────────────────────────────────────────

class RedFlag(BaseModel):
    category: str  # buzzword | metrics | gap | weak_verbs | tech_overload | length
    severity: str  # critical | warning | info
    message: str
    details: Optional[str] = ""


class RedFlagReport(BaseModel):
    flags: List[RedFlag] = []
    total_count: int = 0
    severity_breakdown: dict = {"critical": 0, "warning": 0, "info": 0}


class RedFlagRequest(BaseModel):
    resume_text: str


class RedFlagResponse(BaseModel):
    report: RedFlagReport


# ── Resume Evolution Tracker ────────────────────────────────────────────────

class VersionSnapshot(BaseModel):
    analysis_id: str
    version_number: int
    ats_score: float
    recruiter_score: float
    created_at: str
    jd_preview: str = ""


class EvolutionTimeline(BaseModel):
    resume_id: str
    total_versions: int
    first_score: float
    latest_score: float
    improvement: float  # percentage improvement
    versions: List[VersionSnapshot]


class EvolutionResponse(BaseModel):
    timeline: EvolutionTimeline


class VersionCompareRequest(BaseModel):
    version1_id: str
    version2_id: str
    user_id: str


class VersionComparison(BaseModel):
    version1: VersionSnapshot
    version2: VersionSnapshot
    score_diff: float
    recruiter_diff: float
    keyword_changes: dict  # added, removed keywords


class CompareResponse(BaseModel):
    comparison: VersionComparison


# ── History ──────────────────────────────────────────────────────────────────

class HistoryItem(BaseModel):
    analysis_id: str
    resume_id: str
    jd_preview: str
    ats_score: float
    recruiter_score: float
    created_at: str


class HistoryResponse(BaseModel):
    items: List[HistoryItem]
    total: int


class AnalysisDetailResponse(BaseModel):
    analysis_id: str
    resume_text: str
    job_description: str
    ats: ATSResult
    recruiter: RecruiterFeedback
    rewritten_bullets: List[RewrittenBullet]
    jd_intelligence: Optional[JDIntelligence] = None
    strength_breakdown: Optional[StrengthBreakdown] = None
    created_at: str
