import os
import anthropic
from typing import Optional
import logging

logger = logging.getLogger("claude-client")

SYSTEM_PROMPT = (
    "You are a professional B2B sales and marketing assistant for the Tudumm platform. "
    "You help generate personalized, high-quality outreach messages and profile summaries. "
    "Always be concise, professional, and personalized. Never use generic templates."
)

client: Optional[anthropic.Anthropic] = None


def get_client() -> anthropic.Anthropic:
    global client
    if client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
        client = anthropic.Anthropic(api_key=api_key)
    return client


def generate_message(prompt: str, max_tokens: int = 1024) -> tuple[str, int]:
    """
    Generate a text completion using Claude claude-sonnet-4-6.
    Returns (text, input_tokens_used).
    Uses prompt caching for the system prompt to reduce costs on repeated calls.
    """
    c = get_client()

    response = c.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                # Cache the system prompt — Anthropic prompt caching
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {"role": "user", "content": prompt}
        ],
    )

    text = response.content[0].text if response.content else ""
    tokens_used = response.usage.input_tokens + response.usage.output_tokens
    logger.info(f"Claude response: {len(text)} chars, {tokens_used} tokens used")
    return text, tokens_used


def generate_structured(prompt: str, max_tokens: int = 2048) -> tuple[str, int]:
    """
    Generate structured output (JSON-ready text) using Claude.
    """
    c = get_client()

    response = c.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        system=[
            {
                "type": "text",
                "text": (
                    SYSTEM_PROMPT
                    + "\n\nWhen asked for structured data, always respond with valid JSON only, "
                    "no prose before or after the JSON object."
                ),
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text if response.content else "{}"
    tokens_used = response.usage.input_tokens + response.usage.output_tokens
    return text, tokens_used
