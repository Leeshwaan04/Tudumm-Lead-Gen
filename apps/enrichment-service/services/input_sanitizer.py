import re
from typing import Any

# Patterns that attempt to escape the intended prompt context
_INJECTION_PATTERNS = [
    re.compile(r'ignore\s+(all\s+)?(previous|prior|above)\s+instructions?', re.IGNORECASE),
    re.compile(r'disregard\s+(all\s+)?(previous|prior|above)\s+instructions?', re.IGNORECASE),
    re.compile(r'forget\s+(all\s+)?(previous|prior|above)', re.IGNORECASE),
    re.compile(r'you\s+are\s+now\s+(?!a\s+professional)', re.IGNORECASE),
    re.compile(r'(system|assistant|human)\s*:', re.IGNORECASE),
    re.compile(r'<\s*(system|assistant|human|instruction)\s*>', re.IGNORECASE),
    re.compile(r'\[INST\]|\[\/INST\]|<<SYS>>|<</SYS>>', re.IGNORECASE),
    re.compile(r'jailbreak|DAN mode|developer mode', re.IGNORECASE),
    re.compile(r'prompt\s*injection', re.IGNORECASE),
    re.compile(r'reveal\s+(your\s+)?(system\s+prompt|instructions)', re.IGNORECASE),
]

MAX_PROMPT_LENGTH = 2000
MAX_CONTEXT_VALUE_LENGTH = 500


def sanitize_text(text: str) -> str:
    """Strip prompt injection attempts from a string and enforce length limit."""
    if not isinstance(text, str):
        return ''
    text = text[:MAX_PROMPT_LENGTH]
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(text):
            raise ValueError('Input contains disallowed content that violates usage policy.')
    return text


def sanitize_context(context: Any) -> Any:
    """Recursively sanitize a context dict/list, enforcing per-value length limits."""
    if isinstance(context, dict):
        return {k: sanitize_context(v) for k, v in context.items()}
    if isinstance(context, list):
        return [sanitize_context(item) for item in context]
    if isinstance(context, str):
        truncated = context[:MAX_CONTEXT_VALUE_LENGTH]
        for pattern in _INJECTION_PATTERNS:
            if pattern.search(truncated):
                raise ValueError('Context contains disallowed content that violates usage policy.')
        return truncated
    return context
