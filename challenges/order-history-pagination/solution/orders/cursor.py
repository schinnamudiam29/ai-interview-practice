"""Opaque pagination cursors.

Clients must treat cursors as opaque strings and pass them back unchanged.
"""

import base64
import json
from datetime import datetime
from typing import Tuple

DIRECTIONS = ("asc", "desc")


def encode_cursor(created_at: datetime, order_id: str, direction: str = "asc") -> str:
    payload = {"ts": created_at.isoformat(), "id": order_id, "dir": direction}
    raw = json.dumps(payload).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii")


def decode_cursor(cursor: str) -> Tuple[datetime, str, str]:
    """Return (created_at, order_id, direction). Raises ValueError on any malformed input."""
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii"))
        payload = json.loads(raw)
        ts = datetime.fromisoformat(payload["ts"])
        order_id = payload["id"]
        direction = payload["dir"]
    except (ValueError, KeyError, TypeError, AttributeError) as exc:
        raise ValueError("invalid cursor") from exc
    if not isinstance(order_id, str) or direction not in DIRECTIONS:
        raise ValueError("invalid cursor")
    return ts, order_id, direction
