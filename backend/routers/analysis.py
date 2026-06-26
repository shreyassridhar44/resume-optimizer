import asyncio
from fastapi import APIRouter, HTTPException, Request, Depends
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
from services.llm_service import (
    simulate_recruiter, rewrite_bullet_points, generate_cover_letter,
    extract_jd_intelligence, generate_skill_gap_roadmap, analyze_strength_breakdown,
)
from services.embeddings import compute_semantic_similarity
from services.parser import parse_resume_sections
from services.storage import get_resume_text, save_analysis, get_analysis_by_id
from core.security import validate_text_length
from core.logging_config import get_logger
from core.rate_limiter import limiter, get_rate_limit
from core.auth import get_current_user
from datetime import datetime

router = APIRouter()
logger = get_logger("analysis")


@router.post("/analyze", response_model=AnalysisResponse)
@limiter.limit(get_rate_limit("ai_heavy"))
async def analyze_resume(
    request: Request,
    req: AnalyzeRequest,
    current_user: str = Depends(get_current_user),
):
    """
    Full analysis pipeline:
    1. Fetch resume text
    2. Run ATS scoring
    3. Run recruiter simulation (LLM)
    4. Rewrite bullet points (LLM)
    5. Store and return results
    
    🔒 Requires authentication: JWT token in Authorization header
    Rate Limited: 8 analyses per hour per IP
    """
    logger.info(f"Analysis started for resume {req.resume_id[:8]} by user {current_user[:8]}")
    
    try:
        # Validate JD length
        validate_text_length(req.job_description, 10000, "Job description")
        
        # Fetch resume text - validates ownership
        logger.info("Fetching resume text...")
        resume_text = await get_resume_text(req.resume_id, current_user)
        
        # Parse for bullet points
        parsed = parse_resume_sections(resume_text)
        logger.info(f"Parsed {len(parsed.bullet_points)} bullet points")
        
        # Run ATS + Recruiter simulation concurrently
        logger.info("Running parallel analysis tasks...")
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
        
        logger.info(f"Analysis scores: ATS={ats_result.score:.1f}%, Recruiter={recruiter_feedback.score:.1f}/10, Semantic={semantic_score:.1f}%")
        
        # Rewrite top bullet points
        bullets_to_rewrite = parsed.bullet_points[:8]  # Top 8 bullets
        logger.info(f"Rewriting {len(bullets_to_rewrite)} bullet points...")
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
        logger.info("Saving analysis to database...")
        analysis_id = await save_analysis(
            user_id=current_user,
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
        
        logger.info(f"✅ Analysis completed: {analysis_id}")
        
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
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
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
@limiter.limit(get_rate_limit("ai_medium"))
async def create_cover_letter(
    request: Request,
    req: CoverLetterRequest,
    current_user: str = Depends(get_current_user),
):
    """
    Generate a tailored cover letter from a stored analysis.
    
    🔒 Requires authentication
    Rate Limited: 15 generations per hour per IP
    """
    logger.info(f"Cover letter generation started for analysis {req.analysis_id[:8]}")
    
    try:
        result = await get_analysis_by_id(req.analysis_id, current_user)
        if not result:
            raise HTTPException(status_code=404, detail="Analysis not found")

        # Extract from flat structure
        resume_text = result.get("resume_text", "")
        jd_text = result.get("job_description", "")

        if not resume_text or not jd_text:
            raise HTTPException(
                status_code=422,
                detail="Could not load resume or job description for this analysis.",
            )

        logger.info(f"Generating cover letter with tone: {req.tone}")
        letter = await generate_cover_letter(
            resume_text=resume_text,
            jd_text=jd_text,
            tone=req.tone or "professional",
            applicant_name=req.applicant_name or "",
            company_name=req.company_name or "",
            role_title=req.role_title or "",
        )
        
        logger.info(f"✅ Cover letter generated ({len(letter)} chars)")
        return CoverLetterResponse(cover_letter=letter, tone=req.tone or "professional")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cover letter generation error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Cover letter generation failed: {str(e)}",
        )


@router.post("/skill-gap", response_model=SkillGapResponse)
@limiter.limit(get_rate_limit("ai_medium"))
async def create_skill_gap_roadmap(
    request: Request,
    req: SkillGapRequest,
    current_user: str = Depends(get_current_user),
):
    """
    Generate a skill-gap learning roadmap from a stored analysis.
    
    🔒 Requires authentication
    Rate Limited: 15 generations per hour per IP
    """
    logger.info(f"Skill gap roadmap generation started for analysis {req.analysis_id[:8]}")
    
    try:
        result = await get_analysis_by_id(req.analysis_id, current_user)
        if not result:
            raise HTTPException(status_code=404, detail="Analysis not found")

        # Extract from flat structure
        resume_text = result.get("resume_text", "")
        jd_text = result.get("job_description", "")
        feedback = result.get("feedback", {})

        if not resume_text or not jd_text:
            raise HTTPException(
                status_code=422,
                detail="Could not load resume or job description for this analysis.",
            )

        # Reuse stored JD intelligence (from the analyze step) as the requirement checklist
        jd_intel = feedback.get("jd_intelligence") or {}
        required_skills = jd_intel.get("required_skills", []) if isinstance(jd_intel, dict) else []
        nice_skills = jd_intel.get("nice_to_have_skills", []) if isinstance(jd_intel, dict) else []

        logger.info("Generating skill gap roadmap...")
        roadmap = await generate_skill_gap_roadmap(
            resume_text=resume_text,
            jd_text=jd_text,
            required_skills=required_skills,
            nice_to_have_skills=nice_skills,
        )
        
        logger.info(f"✅ Skill gap roadmap generated: {len(roadmap.matched_skills)} matched, {len(roadmap.missing_skills)} missing")
        return SkillGapResponse(roadmap=roadmap)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Skill gap roadmap error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Skill gap roadmap generation failed: {str(e)}",
        )


@router.get("/analysis/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user: str = Depends(get_current_user),
):
    """
    Fetch a specific analysis by ID.
    
    🔒 Requires authentication
    """
    result = await get_analysis_by_id(analysis_id, current_user)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # Extract from flat structure
    feedback = result.get("feedback", {})
    
    return {
        "analysis_id": result.get("analysis_id", ""),
        "resume_id": result.get("resume_id", ""),
        "resume_text": result.get("resume_text", "")[:1000],
        "job_description": result.get("job_description", ""),
        "ats": {
            "score": result.get("ats_score", 0),
            "matched_keywords": feedback.get("matched_keywords", []),
            "missing_keywords": feedback.get("missing_keywords", []),
            "total_jd_keywords": 0,
            "keyword_density": 0,
        },
        "recruiter": {
            "score": result.get("recruiter_score", 0),
            "strengths": feedback.get("strengths", []),
            "weaknesses": feedback.get("weaknesses", []),
            "suggestions": feedback.get("suggestions", []),
            "persona": feedback.get("persona", "standard"),
        },
        "rewritten_bullets": feedback.get("rewritten_points", []),
        "jd_intelligence": feedback.get("jd_intelligence") or None,
        "strength_breakdown": feedback.get("strength_breakdown") or None,
        "created_at": result.get("created_at", ""),
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

