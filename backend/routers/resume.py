from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request, Depends
from models.schemas import ResumeUploadResponse
from services.parser import extract_text_from_file, parse_resume_sections
from services.storage import upload_resume_file, save_resume_record_with_latex
from services.latex_service import resume_to_latex
from core.config import settings
from core.security import validate_file_size, validate_file_type, sanitize_filename
from core.logging_config import get_logger
from core.rate_limiter import limiter, get_rate_limit
from core.auth import get_current_user

router = APIRouter()
logger = get_logger("resume")

MAX_SIZE_BYTES = settings.MAX_FILE_SIZE_MB * 1024 * 1024


@router.post("/upload-resume", response_model=ResumeUploadResponse)
@limiter.limit(get_rate_limit("upload"))
async def upload_resume(
    request: Request,
    file: UploadFile = File(...),
    current_user: str = Depends(get_current_user),
):
    """
    Upload a resume (PDF or DOCX), extract text, convert to LaTeX, and store in Supabase.
    LaTeX format preserves ALL formatting and structure.
    
    🔒 Requires authentication: JWT token in Authorization header
    Rate Limited: 20 uploads per hour per IP
    """
    logger.info(f"Resume upload started for user {current_user[:8]}")
    
    try:
        # Validate filename
        filename = file.filename or "resume.pdf"
        filename = sanitize_filename(filename)
        
        # Validate file type
        validate_file_type(filename, ["pdf", "docx"])
        
        # Read and size-check
        file_bytes = await file.read()
        validate_file_size(file_bytes, settings.MAX_FILE_SIZE_MB)
        
        logger.info(f"File validated: {filename} ({len(file_bytes)} bytes)")
        
        # Extract text
        import io
        up = UploadFile(filename=filename, file=io.BytesIO(file_bytes))
        raw_text = await extract_text_from_file(up)
        
        if not raw_text or len(raw_text.strip()) < 50:
            logger.warning(f"Extracted text too short: {len(raw_text)} chars")
            raise HTTPException(
                status_code=400,
                detail="Could not extract sufficient text from resume. Please ensure it's a valid PDF or DOCX file.",
            )
        
        logger.info(f"Text extracted: {len(raw_text)} characters")
        
        # Parse sections
        parsed = parse_resume_sections(raw_text)
        
        # Convert to LaTeX (preserves formatting)
        logger.info("Generating LaTeX code...")
        latex_code = await resume_to_latex(raw_text, filename)
        logger.info(f"LaTeX code ready: {len(latex_code)} characters")
        
        # Upload original file to Supabase Storage
        logger.info("Uploading to Supabase Storage...")
        file_url = await upload_resume_file(file_bytes, filename, current_user)
        
        # Save to DB with LaTeX code
        logger.info("Saving to database...")
        resume_id = await save_resume_record_with_latex(
            user_id=current_user,
            file_url=file_url,
            parsed_text=raw_text,
            latex_code=latex_code,
            filename=filename,
        )
        
        logger.info(f"✅ Resume upload completed: {resume_id}")
        
        return ResumeUploadResponse(
            resume_id=resume_id,
            file_url=file_url,
            parsed_text=raw_text[:500] + "..." if len(raw_text) > 500 else raw_text,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resume upload failed: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process resume: {str(e)}"
        )
