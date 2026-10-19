"""HTTP-ish handler for GET /customers/{id}/orders.

Query params arrive as strings. Returns (status_code, json_body).
"""

from typing import Dict, Tuple

from .cursor import DIRECTIONS
from .models import Order
from .service import OrderHistoryService

DEFAULT_LIMIT = 20
MAX_LIMIT = 100


def serialize(order: Order) -> dict:
    return {
        "id": order.id,
        "created_at": order.created_at.isoformat(),
        "total_cents": order.total_cents,
        "status": order.status,
    }


def list_orders(
    service: OrderHistoryService, customer_id: str, params: Dict[str, str]
) -> Tuple[int, dict]:
    try:
        limit = int(params.get("limit", DEFAULT_LIMIT))
    except ValueError:
        return 400, {"error": "limit must be an integer"}
    if limit < 1 or limit > MAX_LIMIT:
        return 400, {"error": f"limit must be between 1 and {MAX_LIMIT}"}

    order = params.get("order", "asc")
    if order not in DIRECTIONS:
        return 400, {"error": "order must be 'asc' or 'desc'"}

    cursor = params.get("cursor")
    try:
        page = service.get_page(customer_id, limit=limit, cursor=cursor, order=order)
    except ValueError:
        return 400, {"error": "invalid cursor"}

    return 200, {
        "orders": [serialize(o) for o in page.items],
        "next_cursor": page.next_cursor,
    }
