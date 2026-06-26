from fastapi import APIRouter, Query, HTTPException, Depends
from models.schemas import HistoryResponse, HistoryItem
from services.storage import get_user_history, delete_analysis
from core.logging_config import get_logger
from core.auth import get_current_user

router = APIRouter()
logger = get_logger("history")


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    current_user: str = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Fetch analysis history for authenticated user.
    
    🔒 Requires authentication
    """
    logger.info(f"Fetching history for user {current_user[:8]} (limit={limit})")
    try:
        items_raw = await get_user_history(current_user, limit)
        
        items = []
        for row in items_raw:
            jd_content = ""
            if row.get("job_descriptions"):
                jd_content = row["job_descriptions"].get("content", "")
            
            items.append(HistoryItem(
                analysis_id=row["id"],
                resume_id=row["resume_id"],
                jd_preview=jd_content[:120] + "..." if len(jd_content) > 120 else jd_content,
                ats_score=row.get("ats_score", 0),
                recruiter_score=row.get("recruiter_score", 0),
                created_at=row.get("created_at", ""),
            ))
        
        logger.info(f"✅ History fetched: {len(items)} items")
        return HistoryResponse(items=items, total=len(items))
    except Exception as e:
        logger.error(f"History fetch failed: {type(e).__name__}: {e}")
        raise


@router.delete("/history/{analysis_id}")
async def delete_history_item(
    analysis_id: str,
    current_user: str = Depends(get_current_user),
):
    """
    Delete a specific analysis by ID.
    
    🔒 Requires authentication
    """
    logger.info(f"Deleting analysis {analysis_id[:8]} for user {current_user[:8]}")
    try:
        success = await delete_analysis(analysis_id, current_user)
        if not success:
            logger.warning(f"Analysis {analysis_id[:8]} not found or already deleted")
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        logger.info(f"✅ Analysis {analysis_id[:8]} deleted successfully")
        return {"success": True, "message": "Analysis deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete analysis: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete analysis: {str(e)}")