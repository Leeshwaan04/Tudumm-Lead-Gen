import os
import json
import httpx
from typing import Optional
import logging

logger = logging.getLogger("groq-client")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = (
    "You are a professional B2B sales and marketing assistant for the Tudumm platform. "
    "You help generate personalized, high-quality outreach messages and profile summaries. "
    "Always be concise, professional, and personalized. Never use generic templates. "
    "When asked for structured data, respond with valid JSON only — no prose before or after."
)

_client: Optional[httpx.Client] = None


def _get_client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(timeout=30)
    return _client


def _call(messages: list[dict], max_tokens: int = 1024) -> tuple[str, int]:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is not set")

    payload = {
        "model": MODEL,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }

    resp = _get_client().post(
        GROQ_API_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
    )
    resp.raise_for_status()
    data = resp.json()
    text = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    tokens = usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)
    logger.info(f"Groq response: {len(text)} chars, {tokens} tokens")
    return text, tokens


def generate_message(prompt: str, max_tokens: int = 1024) -> tuple[str, int]:
    return _call([{"role": "user", "content": prompt}], max_tokens)


def generate_structured(prompt: str, max_tokens: int = 2048) -> tuple[str, int]:
    return _call([{"role": "user", "content": prompt}], max_tokens)
