"""
Auto-Editor router: AI-powered resume editing using LaTeX.
LaTeX preserves ALL formatting perfectly!
"""
import uuid
from fastapi import APIRouter, HTTPException, Request, Depends
from models.schemas import (
    AutoEditSuggestionsRequest,
    AutoEditSuggestionsResponse,
    ApplyEditsRequest,
    ApplyEditsResponse,
    GeneratedResumeFile,
    EditSuggestion,
)
from services.llm_service import generate_auto_edit_suggestions
from services.latex_service import apply_edits_to_latex, latex_to_pdf, latex_to_docx_simple
from services.storage import get_analysis_by_id
from core.supabase import get_supabase
from core.config import settings
from core.rate_limiter import limiter, get_rate_limit
from core.logging_config import get_logger
from core.auth import get_current_user

router = APIRouter(prefix="/api", tags=["auto-editor"])
logger = get_logger("auto_editor")


@router.post("/auto-edit-suggestions", response_model=AutoEditSuggestionsResponse)
@limiter.limit(get_rate_limit("ai_light"))
async def get_auto_edit_suggestions(
    request: Request,
    req: AutoEditSuggestionsRequest,
    current_user: str = Depends(get_current_user),
):
    """
    Generate AI-powered edit suggestions for a resume based on its analysis.
    
    🔒 Requires authentication
    Rate Limited: 20 requests per hour per IP
    """
    logger.info(f"Auto-edit suggestions requested for analysis {req.analysis_id[:8]}")
    try:
        # Fetch the analysis - validates ownership
        analysis = await get_analysis_by_id(req.analysis_id, current_user)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        # Extract data from analysis
        resume_text = analysis.get("resume_text", "")
        job_description = analysis.get("job_description", "")
        
        if not resume_text or not job_description:
            raise HTTPException(status_code=400, detail="Resume text or job description missing from analysis")
        
        # Extract ATS and recruiter feedback
        from models.schemas import ATSResult, RecruiterFeedback
        
        feedback_data = analysis.get("feedback", {})
        
        # Build ATS result
        ats_result = ATSResult(
            score=float(analysis.get("ats_score", 0)),
            matched_keywords=feedback_data.get("matched_keywords", []),
            missing_keywords=feedback_data.get("missing_keywords", []),
            total_jd_keywords=len(feedback_data.get("matched_keywords", [])) + len(feedback_data.get("missing_keywords", [])),
            keyword_density=float(analysis.get("ats_score", 0)),
        )
        
        # Build recruiter feedback
        recruiter_feedback = RecruiterFeedback(
            score=float(analysis.get("recruiter_score", 0)),
            strengths=feedback_data.get("strengths", []),
            weaknesses=feedback_data.get("weaknesses", []),
            suggestions=feedback_data.get("suggestions", []),
            persona=feedback_data.get("persona", "standard"),
        )
        
        # Generate suggestions
        suggestions, summary = await generate_auto_edit_suggestions(
            resume_text=resume_text,
            jd_text=job_description,
            ats_result=ats_result,
            recruiter_feedback=recruiter_feedback,
            max_suggestions=req.max_suggestions,
        )
        
        return AutoEditSuggestionsResponse(
            suggestions=suggestions,
            total_count=len(suggestions),
            summary=summary,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Auto-edit suggestions failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate suggestions: {str(e)}")


@router.post("/apply-edits", response_model=ApplyEditsResponse)
@limiter.limit(get_rate_limit("ai_light"))
async def apply_resume_edits(
    request: Request,
    req: ApplyEditsRequest,
    current_user: str = Depends(get_current_user),
):
    """
    Apply selected edit suggestions using LaTeX for perfect formatting preservation.
    Uses the original LaTeX code stored in the database.
    
    🔒 Requires authentication
    Rate Limited: 20 requests per hour per IP
    """
    logger.info(f"Applying {len(req.applied_suggestions)} edits for analysis {req.analysis_id[:8]}")
    try:
        print(f"⏳ Applying {len(req.applied_suggestions)} edits...")
        
        # Fetch the analysis to get the original LaTeX code - validates ownership
        analysis = await get_analysis_by_id(req.analysis_id, current_user)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        latex_code = analysis.get("latex_code", "")
        
        # If no LaTeX code in DB, generate it from resume text
        if not latex_code:
            print("⚠️ No LaTeX code in database, generating from resume text...")
            from services.latex_service import resume_to_latex
            latex_code = await resume_to_latex(req.resume_text)
        else:
            print(f"✅ Using stored LaTeX code ({len(latex_code)} chars)")
        
        # Apply edits to LaTeX using LLM-powered intelligent merging
        suggestions_dicts = [s.model_dump() for s in req.applied_suggestions]
        edited_latex, changes_summary = await apply_edits_to_latex(latex_code, suggestions_dicts)
        
        print(f"✅ Applied {len(suggestions_dicts)} edits to LaTeX code")
        
        # Generate files based on format
        files: list[GeneratedResumeFile] = []
        supabase = get_supabase()
        
        # Generate DOCX from the edited LaTeX
        if req.format in ("docx", "both"):
            try:
                print("🔄 Converting to DOCX...")
                docx_bytes = await latex_to_docx_simple(edited_latex)
                
                # Upload to Supabase Storage
                docx_path = f"{current_user}/edited/{uuid.uuid4()}_resume_optimized.docx"
                
                supabase.storage.from_(settings.SUPABASE_BUCKET).upload(
                    docx_path,
                    docx_bytes,
                    file_options={"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
                )
                print(f"✅ DOCX uploaded: {docx_path}")
                
                # Get signed URL
                docx_url_response = supabase.storage.from_(settings.SUPABASE_BUCKET).create_signed_url(docx_path, 3600)
                docx_url = docx_url_response.get("signedURL", "") if isinstance(docx_url_response, dict) else ""
                
                if docx_url:
                    files.append(GeneratedResumeFile(
                        format="docx",
                        filename="resume_optimized.docx",
                        download_url=docx_url,
                        size_bytes=len(docx_bytes),
                    ))
            except Exception as docx_err:
                print(f"⚠️ DOCX generation failed: {docx_err}")
        
        # Generate PDF from LaTeX if pdflatex is available, otherwise provide LaTeX source
        if req.format in ("pdf", "both"):
            try:
                print("🔄 Attempting to compile LaTeX to PDF...")
                pdf_bytes = await latex_to_pdf(edited_latex)
                
                # Upload PDF
                pdf_path = f"{current_user}/edited/{uuid.uuid4()}_resume_optimized.pdf"
                
                supabase.storage.from_(settings.SUPABASE_BUCKET).upload(
                    pdf_path,
                    pdf_bytes,
                    file_options={"content-type": "application/pdf"}
                )
                print(f"✅ PDF uploaded: {pdf_path}")
                
                # Get signed URL
                pdf_url_response = supabase.storage.from_(settings.SUPABASE_BUCKET).create_signed_url(pdf_path, 3600)
                pdf_url = pdf_url_response.get("signedURL", "") if isinstance(pdf_url_response, dict) else ""
                
                if pdf_url:
                    files.append(GeneratedResumeFile(
                        format="pdf",
                        filename="resume_optimized.pdf",
                        download_url=pdf_url,
                        size_bytes=len(pdf_bytes),
                    ))
            except Exception as pdf_err:
                print(f"⚠️ PDF generation failed (pdflatex not available?): {pdf_err}")
                # Fallback: provide LaTeX source
                try:
                    print("🔄 Providing LaTeX source as fallback...")
                    latex_bytes = edited_latex.encode('utf-8')
                    
                    # Upload LaTeX source
                    latex_path = f"{current_user}/edited/{uuid.uuid4()}_resume_optimized.tex"
                    
                    supabase.storage.from_(settings.SUPABASE_BUCKET).upload(
                        latex_path,
                        latex_bytes,
                        file_options={"content-type": "text/plain"}
                    )
                    print(f"✅ LaTeX source uploaded: {latex_path}")
                    
                    # Get signed URL
                    latex_url_response = supabase.storage.from_(settings.SUPABASE_BUCKET).create_signed_url(latex_path, 3600)
                    latex_url = latex_url_response.get("signedURL", "") if isinstance(latex_url_response, dict) else ""
                    
                    if latex_url:
                        files.append(GeneratedResumeFile(
                            format="tex",
                            filename="resume_optimized.tex",
                            download_url=latex_url,
                            size_bytes=len(latex_bytes),
                        ))
                except Exception as latex_err:
                    print(f"⚠️ LaTeX source upload failed: {latex_err}")
        
        # Extract readable text from LaTeX for preview
        edited_text = _latex_to_text_preview(edited_latex)
        
        return ApplyEditsResponse(
            success=True,
            edited_text=edited_text,
            files=files,
            changes_summary=f"{changes_summary}. Complete optimized resume generated.",
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Apply edits failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to apply edits: {str(e)}")


def _latex_to_text_preview(latex_code: str) -> str:
    """Extract readable text from LaTeX code for preview."""
    import re
    text = latex_code
    
    # Remove preamble
    text = re.sub(r'\\documentclass.*?\\begin\{document\}', '', text, flags=re.DOTALL)
    text = re.sub(r'\\end\{document\}', '', text)
    
    # Remove LaTeX commands but keep content
    text = re.sub(r'\\section\{(.*?)\}', r'\n\n\1\n', text)
    text = re.sub(r'\\subsection\{(.*?)\}', r'\n\1\n', text)
    text = re.sub(r'\\textbf\{(.*?)\}', r'\1', text)
    text = re.sub(r'\\textit\{(.*?)\}', r'\1', text)
    text = re.sub(r'\\item\s+', '• ', text)
    text = re.sub(r'\\begin\{itemize\}', '', text)
    text = re.sub(r'\\end\{itemize\}', '', text)
    text = re.sub(r'\\begin\{enumerate\}', '', text)
    text = re.sub(r'\\end\{enumerate\}', '', text)
    text = re.sub(r'\\\\', '\n', text)
    text = re.sub(r'\\[a-zA-Z]+(\[.*?\])?\{(.*?)\}', r'\2', text)  # Remove remaining commands with content
    text = re.sub(r'\\[a-zA-Z]+', '', text)  # Remove command names
    
    # Clean up whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = '\n'.join(line.strip() for line in text.split('\n'))
    
    return text.strip()