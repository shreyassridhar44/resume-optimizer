import asyncio
from fastapi import APIRouter, HTTPException
from models.schemas import (
    AnalyzeRequest, AnalysisResponse, AnalysisResult,
    RewriteRequest, RewriteResponse,
    CoverLetterRequest, CoverLetterResponse,
    SkillGapRequest, SkillGapResponse,
    LiveFeedbackRequest, LiveFeedbackResponse,
    RedFlagRequest, RedFlagResponse,
    ATSResult, RecruiterFeedback,
)
from services.ats_engine import compute_ats_score, compute_live_feedback, detect_red_flags
from services.gemini_service import (
    simulate_recruiter, rewrite_bullet_points, generate_cover_letter,
    extract_jd_intelligence, generate_skill_gap_roadmap, analyze_strength_breakdown,
)
from services.embeddings import compute_semantic_similarity
from services.parser import parse_resume_sections
from services.storage import get_resume_text, save_analysis, get_analysis_by_id
from datetime import datetime

router = APIRouter()


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_resume(req: AnalyzeRequest):
    """
    Full analysis pipeline:
    1. Fetch resume text
    2. Run ATS scoring
    3. Run recruiter simulation (LLM)
    4. Rewrite bullet points (LLM)
    5. Store and return results
    """
    # Fetch resume text
    resume_text = await get_resume_text(req.resume_id, req.user_id)
    
    # Parse for bullet points
    parsed = parse_resume_sections(resume_text)
    
    # Run ATS + Recruiter simulation concurrently
    ats_task = asyncio.create_task(
        asyncio.to_thread(compute_ats_score, resume_text, req.job_description)
    )
    recruiter_task = asyncio.create_task(
        simulate_recruiter(
            resume_text,
            req.job_description,
            req.role_type or "general",
            req.persona or "standard",
        )
    )
    jd_intel_task = asyncio.create_task(
        extract_jd_intelligence(req.job_description)
    )
    strength_task = asyncio.create_task(
        analyze_strength_breakdown(resume_text, req.job_description)
    )
    semantic_task = asyncio.create_task(
        compute_semantic_similarity(resume_text, req.job_description)
    )

    ats_result, recruiter_feedback, jd_intelligence, strength_breakdown, (semantic_score, semantic_meta) = await asyncio.gather(
        ats_task, recruiter_task, jd_intel_task, strength_task, semantic_task
    )
    
    # Rewrite top bullet points
    bullets_to_rewrite = parsed.bullet_points[:8]  # Top 8 bullets
    rewritten = await rewrite_bullet_points(bullets_to_rewrite, req.job_description[:500])
    
    # Build semantic match result
    from models.schemas import SemanticMatch
    semantic_match = SemanticMatch(
        score=semantic_score,
        interpretation=semantic_meta.get("interpretation", ""),
        embedding_dimensions=semantic_meta.get("embedding_dimensions", 128),
        raw_similarity=semantic_meta.get("raw_similarity", 0.0),
        keyword_score=ats_result.score,
        score_difference=round(semantic_score - ats_result.score, 1),
    )
    
    # Save to DB
    analysis_id = await save_analysis(
        user_id=req.user_id,
        resume_id=req.resume_id,
        jd_content=req.job_description,
        ats_score=ats_result.score,
        recruiter_score=recruiter_feedback.score,
        ats_data=ats_result.model_dump(),
        recruiter_data=recruiter_feedback.model_dump(),
        rewritten_bullets=[r.model_dump() for r in rewritten],
        jd_intelligence=jd_intelligence.model_dump(),
        strength_breakdown=strength_breakdown.model_dump(),
    )
    
    return AnalysisResponse(
        data=AnalysisResult(
            analysis_id=analysis_id,
            ats=ats_result,
            recruiter=recruiter_feedback,
            rewritten_bullets=rewritten,
            jd_intelligence=jd_intelligence,
            strength_breakdown=strength_breakdown,
            semantic_match=semantic_match,
            created_at=datetime.utcnow().isoformat(),
        )
    )


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite_bullets(req: RewriteRequest):
    """Standalone endpoint to rewrite resume bullet points."""
    if not req.bullet_points:
        raise HTTPException(status_code=400, detail="No bullet points provided")
    
    if len(req.bullet_points) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 bullet points per request")
    
    rewritten = await rewrite_bullet_points(req.bullet_points, req.job_context or "")
    return RewriteResponse(rewritten=rewritten)


@router.post("/live-feedback", response_model=LiveFeedbackResponse)
async def live_feedback(req: LiveFeedbackRequest):
    """
    Instant, LLM-free scoring for the real-time resume editor.
    Runs keyword matching + local heuristics — safe to call on every keystroke.
    """
    return await asyncio.to_thread(
        compute_live_feedback, req.resume_text, req.job_description
    )


@router.post("/cover-letter", response_model=CoverLetterResponse)
async def create_cover_letter(req: CoverLetterRequest):
    """Generate a tailored cover letter from a stored analysis (resume + job description)."""
    result = await get_analysis_by_id(req.analysis_id, req.user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")

    analysis = result["analysis"]
    resume_text = (analysis.get("resumes") or {}).get("parsed_text", "")
    jd_text = (analysis.get("job_descriptions") or {}).get("content", "")

    if not resume_text or not jd_text:
        raise HTTPException(
            status_code=422,
            detail="Could not load resume or job description for this analysis.",
        )

    try:
        letter = await generate_cover_letter(
            resume_text=resume_text,
            jd_text=jd_text,
            tone=req.tone or "professional",
            applicant_name=req.applicant_name or "",
            company_name=req.company_name or "",
            role_title=req.role_title or "",
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Cover letter generation failed. Please try again.",
        )

    return CoverLetterResponse(cover_letter=letter, tone=req.tone or "professional")


@router.post("/skill-gap", response_model=SkillGapResponse)
async def create_skill_gap_roadmap(req: SkillGapRequest):
    """Generate a skill-gap learning roadmap from a stored analysis."""
    result = await get_analysis_by_id(req.analysis_id, req.user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")

    analysis = result["analysis"]
    feedback = result["feedback"]
    resume_text = (analysis.get("resumes") or {}).get("parsed_text", "")
    jd_text = (analysis.get("job_descriptions") or {}).get("content", "")

    if not resume_text or not jd_text:
        raise HTTPException(
            status_code=422,
            detail="Could not load resume or job description for this analysis.",
        )

    # Reuse stored JD intelligence (from the analyze step) as the requirement checklist
    jd_intel = feedback.get("jd_intelligence") or {}
    required_skills = jd_intel.get("required_skills", []) if isinstance(jd_intel, dict) else []
    nice_skills = jd_intel.get("nice_to_have_skills", []) if isinstance(jd_intel, dict) else []

    try:
        roadmap = await generate_skill_gap_roadmap(
            resume_text=resume_text,
            jd_text=jd_text,
            required_skills=required_skills,
            nice_to_have_skills=nice_skills,
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Skill gap roadmap generation failed. Please try again.",
        )

    return SkillGapResponse(roadmap=roadmap)


@router.get("/analysis/{analysis_id}")
async def get_analysis(analysis_id: str, user_id: str):
    """Fetch a specific analysis by ID."""
    result = await get_analysis_by_id(analysis_id, user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    analysis = result["analysis"]
    feedback = result["feedback"]
    
    return {
        "analysis_id": analysis_id,
        "resume_id": analysis.get("resume_id", ""),
        "resume_text": analysis.get("resumes", {}).get("parsed_text", "")[:1000],
        "job_description": analysis.get("job_descriptions", {}).get("content", ""),
        "ats": {
            "score": analysis.get("ats_score", 0),
            "matched_keywords": feedback.get("matched_keywords", []),
            "missing_keywords": feedback.get("missing_keywords", []),
            "total_jd_keywords": 0,
            "keyword_density": 0,
        },
        "recruiter": {
            "score": analysis.get("recruiter_score", 0),
            "strengths": feedback.get("strengths", []),
            "weaknesses": feedback.get("weaknesses", []),
            "suggestions": feedback.get("suggestions", []),
            "persona": feedback.get("persona", "standard"),
        },
        "rewritten_bullets": feedback.get("rewritten_points", []),
        "jd_intelligence": feedback.get("jd_intelligence") or None,
        "strength_breakdown": feedback.get("strength_breakdown") or None,
        "created_at": analysis.get("created_at", ""),
    }


@router.post("/red-flags", response_model=RedFlagResponse)
async def analyze_red_flags(req: RedFlagRequest):
    """
    Detect resume red flags that recruiters dislike.
    
    Checks for:
    - Overused buzzwords (synergy, leverage, etc.)
    - Lack of metrics and numbers
    - Weak action verbs
    - Employment gaps
    - Technology overload
    - Resume length issues
    
    Returns categorized warnings with severity levels.
    """
    if not req.resume_text or len(req.resume_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Resume text is too short to analyze")
    
    report = await asyncio.to_thread(detect_red_flags, req.resume_text)
    return RedFlagResponse(report=report)

