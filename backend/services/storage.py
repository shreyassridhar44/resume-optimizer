import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import HTTPException
from core.supabase import get_supabase
from core.config import settings


# ── Resume Storage ────────────────────────────────────────────────────────────

async def upload_resume_file(file_bytes: bytes, filename: str, user_id: str) -> str:
    """Upload resume file to Supabase Storage and return public URL."""
    supabase = get_supabase()
    
    ext = filename.rsplit(".", 1)[-1].lower()
    storage_path = f"{user_id}/{uuid.uuid4()}.{ext}"
    
    try:
        supabase.storage.from_(settings.SUPABASE_BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": f"application/{'pdf' if ext == 'pdf' else 'vnd.openxmlformats-officedocument.wordprocessingml.document'}"},
        )
        
        url_data = supabase.storage.from_(settings.SUPABASE_BUCKET).get_public_url(storage_path)
        return url_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")


async def save_resume_record(
    user_id: str,
    file_url: str,
    parsed_text: str,
    filename: str,
) -> str:
    """Save resume metadata to database and return resume_id."""
    supabase = get_supabase()
    resume_id = str(uuid.uuid4())
    
    try:
        supabase.table("resumes").insert({
            "id": resume_id,
            "user_id": user_id,
            "file_url": file_url,
            "parsed_text": parsed_text,
            "filename": filename,
            "created_at": datetime.utcnow().isoformat(),
        }).execute()
        return resume_id
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save resume: {str(e)}")


async def get_resume_text(resume_id: str, user_id: str) -> str:
    """Fetch parsed resume text from database."""
    supabase = get_supabase()
    
    try:
        result = (
            supabase.table("resumes")
            .select("parsed_text")
            .eq("id", resume_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Resume not found")
        return result.data["parsed_text"]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch resume: {str(e)}")


# ── Analysis Storage ──────────────────────────────────────────────────────────

async def save_analysis(
    user_id: str,
    resume_id: str,
    jd_content: str,
    ats_score: float,
    recruiter_score: float,
    ats_data: dict,
    recruiter_data: dict,
    rewritten_bullets: list,
) -> str:
    """Save full analysis result to database."""
    supabase = get_supabase()
    analysis_id = str(uuid.uuid4())
    
    try:
        # Save JD
        jd_id = str(uuid.uuid4())
        supabase.table("job_descriptions").insert({
            "id": jd_id,
            "user_id": user_id,
            "content": jd_content,
            "created_at": datetime.utcnow().isoformat(),
        }).execute()
        
        # Save analysis
        supabase.table("analyses").insert({
            "id": analysis_id,
            "user_id": user_id,
            "resume_id": resume_id,
            "jd_id": jd_id,
            "ats_score": ats_score,
            "recruiter_score": recruiter_score,
            "created_at": datetime.utcnow().isoformat(),
        }).execute()
        
        # Save feedback
        supabase.table("feedback").insert({
            "id": str(uuid.uuid4()),
            "analysis_id": analysis_id,
            "missing_keywords": ats_data.get("missing_keywords", []),
            "matched_keywords": ats_data.get("matched_keywords", []),
            "suggestions": recruiter_data.get("suggestions", []),
            "strengths": recruiter_data.get("strengths", []),
            "weaknesses": recruiter_data.get("weaknesses", []),
            "rewritten_points": rewritten_bullets,
            "persona": recruiter_data.get("persona", "standard"),
            "created_at": datetime.utcnow().isoformat(),
        }).execute()
        
        return analysis_id
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save analysis: {str(e)}")


async def get_analysis_by_id(analysis_id: str, user_id: str) -> Optional[dict]:
    """Fetch full analysis details."""
    supabase = get_supabase()
    
    try:
        analysis = (
            supabase.table("analyses")
            .select("*, job_descriptions(content), resumes(parsed_text)")
            .eq("id", analysis_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not analysis.data:
            return None
        
        feedback = (
            supabase.table("feedback")
            .select("*")
            .eq("analysis_id", analysis_id)
            .single()
            .execute()
        )
        
        return {
            "analysis": analysis.data,
            "feedback": feedback.data if feedback.data else {},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch analysis: {str(e)}")


async def get_user_history(user_id: str, limit: int = 20) -> List[dict]:
    """Fetch analysis history for a user."""
    supabase = get_supabase()
    
    try:
        result = (
            supabase.table("analyses")
            .select("id, resume_id, ats_score, recruiter_score, created_at, job_descriptions(content)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


async def delete_analysis(analysis_id: str, user_id: str) -> bool:
    """Delete an analysis and its associated feedback."""
    supabase = get_supabase()
    
    try:
        # Verify ownership first
        check = (
            supabase.table("analyses")
            .select("id")
            .eq("id", analysis_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not check.data:
            return False
        
        # Delete feedback first (foreign key constraint)
        supabase.table("feedback").delete().eq("analysis_id", analysis_id).execute()
        
        # Delete analysis
        supabase.table("analyses").delete().eq("id", analysis_id).eq("user_id", user_id).execute()
        
        return True
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete analysis: {str(e)}")