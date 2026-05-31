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


class RewrittenBullet(BaseModel):
    original: str
    improved: str


class AnalysisResult(BaseModel):
    analysis_id: str
    ats: ATSResult
    recruiter: RecruiterFeedback
    rewritten_bullets: List[RewrittenBullet]
    jd_intelligence: Optional[JDIntelligence] = None
    created_at: str


class AnalysisResponse(BaseModel):
    success: bool = True
    data: AnalysisResult


# ── Rewrite ──────────────────────────────────────────────────────────────────

class RewriteRequest(BaseModel):
    bullet_points: List[str]
    job_context: Optional[str] = ""


class RewriteResponse(BaseModel):
    rewritten: List[RewrittenBullet]


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
    created_at: str
