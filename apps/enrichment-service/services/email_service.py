import dns.resolver
import smtplib
import socket
import logging
from typing import Optional

logger = logging.getLogger("email-service")

SMTP_TIMEOUT = 10  # seconds
SMTP_FROM = "verify@tudumm.io"


def generate_candidates(first_name: str, last_name: str, domain: str) -> list[dict]:
    """
    Generate common email address candidates for a person at a given domain.
    Returns a list of {address, confidence} dicts.
    """
    first = first_name.lower().strip()
    last = last_name.lower().strip()
    f = first[0] if first else ""
    l = last[0] if last else ""

    candidates = [
        {"address": f"{first}.{last}@{domain}", "confidence": 0.85},
        {"address": f"{f}{last}@{domain}", "confidence": 0.75},
        {"address": f"{first}{l}@{domain}", "confidence": 0.65},
        {"address": f"{first}@{domain}", "confidence": 0.55},
        {"address": f"{last}@{domain}", "confidence": 0.45},
        {"address": f"{first}_{last}@{domain}", "confidence": 0.40},
        {"address": f"{f}.{last}@{domain}", "confidence": 0.60},
        {"address": f"{first}{last}@{domain}", "confidence": 0.50},
    ]
    return candidates


def find_email(first_name: str, last_name: str, domain: str) -> list[dict]:
    """
    Generate email candidates and filter by MX record existence.
    Returns enriched list with MX-verified flag.
    """
    candidates = generate_candidates(first_name, last_name, domain)
    mx_valid = _check_mx(domain)

    results = []
    for c in candidates:
        result = {
            "address": c["address"],
            "confidence": c["confidence"] if mx_valid else c["confidence"] * 0.3,
            "mx_valid": mx_valid,
            "format_valid": True,
        }
        results.append(result)

    # Sort by confidence descending
    results.sort(key=lambda x: x["confidence"], reverse=True)
    return results


def verify_email(email: str) -> dict:
    """
    Verify an email address via:
    1. Format check
    2. DNS MX record lookup
    3. SMTP EHLO handshake (no actual email sent)
    """
    import re

    # Basic format check
    email_regex = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, email):
        return {
            "valid": False,
            "deliverable": False,
            "reason": "invalid_format",
            "mx_records": [],
        }

    domain = email.split("@")[1]

    # MX record lookup
    mx_records = _get_mx_records(domain)
    if not mx_records:
        return {
            "valid": True,
            "deliverable": False,
            "reason": "no_mx_records",
            "mx_records": [],
        }

    # SMTP EHLO check
    deliverable, reason = _smtp_check(email, mx_records[0])

    return {
        "valid": True,
        "deliverable": deliverable,
        "reason": reason,
        "mx_records": mx_records[:3],  # Return top 3 MX records
    }


def _check_mx(domain: str) -> bool:
    """Check if a domain has valid MX records."""
    return len(_get_mx_records(domain)) > 0


def _get_mx_records(domain: str) -> list[str]:
    """Resolve MX records for a domain, sorted by priority."""
    try:
        answers = dns.resolver.resolve(domain, "MX")
        mx_list = sorted(answers, key=lambda r: r.preference)
        return [str(r.exchange).rstrip(".") for r in mx_list]
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.DNSException) as e:
        logger.debug(f"MX lookup failed for {domain}: {e}")
        return []


def _smtp_check(email: str, mx_host: str) -> tuple[bool, str]:
    """
    Perform an SMTP EHLO + RCPT TO check without sending an email.
    Returns (deliverable, reason).
    """
    try:
        with smtplib.SMTP(timeout=SMTP_TIMEOUT) as smtp:
            smtp.connect(mx_host, 25)
            smtp.ehlo("tudumm.io")
            smtp.mail(SMTP_FROM)
            code, message = smtp.rcpt(email)

            if code == 250:
                return True, "mailbox_exists"
            elif code == 550:
                return False, "mailbox_not_found"
            elif code == 421 or code == 450 or code == 451:
                return False, "temporarily_unavailable"
            else:
                return False, f"smtp_code_{code}"
    except smtplib.SMTPConnectError:
        return False, "smtp_connect_error"
    except smtplib.SMTPServerDisconnected:
        return False, "smtp_disconnected"
    except socket.timeout:
        return False, "smtp_timeout"
    except OSError as e:
        logger.debug(f"SMTP check error for {email}: {e}")
        return False, "network_error"
