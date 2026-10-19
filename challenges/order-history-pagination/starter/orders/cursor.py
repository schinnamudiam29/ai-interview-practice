"""Opaque pagination cursors.

Clients must treat cursors as opaque strings and pass them back unchanged.
"""

import base64
import json
from datetime import datetime


def encode_cursor(created_at: datetime) -> str:
    payload = {"ts": created_at.isoformat()}
    raw = json.dumps(payload).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii")


def decode_cursor(cursor: str) -> datetime:
    raw = base64.urlsafe_b64decode(cursor.encode("ascii"))
    payload = json.loads(raw)
    return datetime.fromisoformat(payload["ts"])
