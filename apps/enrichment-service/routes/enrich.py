from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
import logging

from services.claude_client import generate_message, generate_structured
from services.email_service import find_email, verify_email
from services.credits import deduct_credits, check_credits
from services.input_sanitizer import sanitize_text, sanitize_context

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
    if not await check_credits(request.user_id, 1):
        raise HTTPException(status_code=402, detail="Insufficient credits")

    try:
        safe_prompt = sanitize_text(request.prompt)
        full_prompt = safe_prompt
        if request.context:
            safe_context = sanitize_context(request.context)
            full_prompt += f"\n\nContext Data: {safe_context}"

        message, tokens = generate_message(full_prompt)
        await deduct_credits(request.user_id, 1)

        return {
            "message": message,
            "tokens_used": tokens,
            "credits_remaining": await check_credits(request.user_id)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Message generation failed: {e}")
        raise HTTPException(status_code=500, detail="Message generation failed")

@router.post("/find-email")
async def find_person_email(request: EmailFindRequest):
    if not await check_credits(request.user_id, 1):
        raise HTTPException(status_code=402, detail="Insufficient credits")

    try:
        sanitize_text(request.first_name)
        sanitize_text(request.last_name)
        sanitize_text(request.domain)
        results = find_email(request.first_name, request.last_name, request.domain)
        await deduct_credits(request.user_id, 1)

        return {
            "results": results,
            "credits_remaining": await check_credits(request.user_id)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Email discovery failed: {e}")
        raise HTTPException(status_code=500, detail="Email discovery failed")

@router.post("/verify-email")
async def verify_person_email(request: VerifyRequest):
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
        raise HTTPException(status_code=500, detail="Email verification failed")

@router.post("/summarize-profile")
async def summarize_profile(request: MessageRequest):
    if not await check_credits(request.user_id, 1):
        raise HTTPException(status_code=402, detail="Insufficient credits")

    try:
        safe_context = sanitize_context(request.context) if request.context else {}
        prompt = f"Summarize the following profile data into 3 key bullet points for a sales outreach:\n\n{safe_context}"
        summary, tokens = generate_structured(prompt)
        await deduct_credits(request.user_id, 1)

        return {
            "summary": summary,
            "tokens_used": tokens,
            "credits_remaining": await check_credits(request.user_id)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Profile summarization failed: {e}")
        raise HTTPException(status_code=500, detail="Profile summarization failed")
