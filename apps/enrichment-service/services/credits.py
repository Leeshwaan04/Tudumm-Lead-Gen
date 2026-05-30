import os
import httpx
import logging
from typing import Optional

logger = logging.getLogger("credits-service")

BILLING_SERVICE_URL = os.environ.get("BILLING_SERVICE_URL", "http://billing-service:8003")


async def check_credits(workspace_id: str, amount: float = 0) -> bool:
    """
    Check if a workspace has enough credits.
    Fail-CLOSED: if billing-service is unreachable, deny the request rather than allow free spend.
    """
    url = f"{BILLING_SERVICE_URL}/billing/credits/balance/{workspace_id}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            if response.status_code == 404:
                return False
            data = response.json()
            balance = data.get("balance", 0)
            return balance >= amount
    except Exception as e:
        logger.error(f"Credit check failed for workspace {workspace_id}: {e}")
        return False  # Fail-closed: deny when billing unavailable

async def deduct_credits(
    workspace_id: str,
    amount: float,
    credit_type: str = "enrichment",
    description: Optional[str] = None,
) -> dict:
    """
    Deduct credits from a workspace by calling the billing-service.
    """
    url = f"{BILLING_SERVICE_URL}/billing/credits/deduct"
    payload = {
        "workspaceId": workspace_id,
        "amount": amount,
        "type": credit_type,
        "description": description or f"Enrichment: {credit_type}",
        "service": "enrichment-service",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 402:
            raise InsufficientCreditsError(
                f"Workspace {workspace_id} has insufficient credits"
            )
        logger.error(f"Billing service HTTP error: {e}")
        raise
    except httpx.RequestError as e:
        # Fail-closed: if we cannot reach billing, refuse to silently skip the deduction.
        # The caller already consumed AI tokens, but better to surface a 503 than spend free forever.
        logger.error(f"Billing service unavailable, cannot deduct credits: {e}")
        raise BillingUnavailableError(f"Billing service unavailable: {e}")


class InsufficientCreditsError(Exception):
    pass


class BillingUnavailableError(Exception):
    pass


# Credit costs per operation type
CREDIT_COSTS = {
    "enrichment_message": 1.0,
    "profile_summary": 0.5,
    "email_find": 0.25,
    "email_verify": 0.1,
    "url_find": 0.25,
}


def get_credit_cost(operation: str) -> float:
    return CREDIT_COSTS.get(operation, 1.0)
