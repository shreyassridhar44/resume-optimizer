from fastapi import APIRouter, HTTPException, Query, Depends
from models.schemas import (
    EvolutionResponse, EvolutionTimeline,
    CompareResponse, VersionComparison,
)
from services.storage import get_resume_evolution, compare_versions
from core.logging_config import get_logger
from core.auth import get_current_user

router = APIRouter()
logger = get_logger("evolution")


@router.get("/evolution/{resume_id}", response_model=EvolutionResponse)
async def get_evolution_timeline(
    resume_id: str,
    current_user: str = Depends(get_current_user),
):
    """
    Get the evolution timeline for a specific resume.
    Shows all versions (analyses) with ATS/recruiter scores over time.
    
    🔒 Requires authentication
    
    Returns:
    - Version history with timestamps
    - Score progression graph data
    - Improvement metrics
    """
    logger.info(f"Fetching evolution timeline for resume {resume_id[:8]}")
    try:
        timeline_data = await get_resume_evolution(resume_id, current_user)
        
        if not timeline_data:
            logger.warning(f"No versions found for resume {resume_id[:8]}")
            raise HTTPException(
                status_code=404,
                detail="No versions found for this resume"
            )
        
        timeline = EvolutionTimeline(**timeline_data)
        logger.info(f"✅ Evolution timeline fetched: {timeline.total_versions} versions")
        return EvolutionResponse(timeline=timeline)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch evolution timeline: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch evolution timeline: {str(e)}")


@router.get("/evolution/compare", response_model=CompareResponse)
async def compare_resume_versions(
    v1: str = Query(..., description="Analysis ID of version 1"),
    v2: str = Query(..., description="Analysis ID of version 2"),
    current_user: str = Depends(get_current_user),
):
    """
    Compare two resume analysis versions side-by-side.
    
    🔒 Requires authentication
    
    Shows:
    - Score differences (ATS, recruiter)
    - Keyword changes (added/removed)
    - Improvement metrics
    """
    logger.info(f"Comparing versions: {v1[:8]} vs {v2[:8]}")
    try:
        comparison_data = await compare_versions(v1, v2, current_user)
        
        if not comparison_data:
            logger.warning(f"One or both versions not found: {v1[:8]}, {v2[:8]}")
            raise HTTPException(
                status_code=404,
                detail="One or both versions not found"
            )
        
        comparison = VersionComparison(**comparison_data)
        logger.info(f"✅ Version comparison completed: score_diff={comparison.score_diff}")
        return CompareResponse(comparison=comparison)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to compare versions: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to compare versions: {str(e)}")
