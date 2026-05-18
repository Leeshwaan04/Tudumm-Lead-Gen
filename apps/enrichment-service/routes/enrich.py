from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
import logging

from services.claude_client import generate_message, generate_structured
from services.email_service import find_email, verify_email
from services.credits import deduct_credits, check_credits

router = APIRouter()
logger = logging.getLogger("enrich-router")

class MessageRequest(BaseModel):
    user_id: str
    prompt: str
    context: Optional[dict] = None

class EmailFindRequest(BaseModel):
    user_id: str
    first_name: str
    last_name: str
    domain: str

class VerifyRequest(BaseModel):
    user_id: str
    email: EmailStr

@router.post("/message")
async def enrich_message(request: MessageRequest):
    """
    Generate a personalized outreach message using AI.
    """
    if not await check_credits(request.user_id, 1):
        raise HTTPException(status_code=402, detail="Insufficient credits")
    
    try:
        # Enhance prompt with context
        full_prompt = request.prompt
        if request.context:
            full_prompt += f"\n\nContext Data: {request.context}"
            
        message, tokens = generate_message(full_prompt)
        await deduct_credits(request.user_id, 1)
        
        return {
            "message": message,
            "tokens_used": tokens,
            "credits_remaining": await check_credits(request.user_id)
        }
    except Exception as e:
        logger.error(f"Message generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/find-email")
async def find_person_email(request: EmailFindRequest):
    """
    Find potential email addresses for a person at a domain.
    """
    if not await check_credits(request.user_id, 1):
        raise HTTPException(status_code=402, detail="Insufficient credits")
        
    try:
        results = find_email(request.first_name, request.last_name, request.domain)
        await deduct_credits(request.user_id, 1)
        
        return {
            "results": results,
            "credits_remaining": await check_credits(request.user_id)
        }
    except Exception as e:
        logger.error(f"Email discovery failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify-email")
async def verify_person_email(request: VerifyRequest):
    """
    Verify if an email address is deliverable.
    """
    if not await check_credits(request.user_id, 1):
        raise HTTPException(status_code=402, detail="Insufficient credits")
        
    try:
        result = verify_email(request.email)
        await deduct_credits(request.user_id, 1)
        
        return {
            "result": result,
            "credits_remaining": await check_credits(request.user_id)
        }
    except Exception as e:
        logger.error(f"Email verification failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/summarize-profile")
async def summarize_profile(request: MessageRequest):
    """
    Generate a concise summary of a LinkedIn/Twitter profile.
    """
    if not await check_credits(request.user_id, 1):
        raise HTTPException(status_code=402, detail="Insufficient credits")
        
    try:
        prompt = f"Summarize the following profile data into 3 key bullet points for a sales outreach:\n\n{request.context}"
        summary, tokens = generate_structured(prompt)
        await deduct_credits(request.user_id, 1)
        
        return {
            "summary": summary,
            "tokens_used": tokens,
            "credits_remaining": await check_credits(request.user_id)
        }
    except Exception as e:
        logger.error(f"Profile summarization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
