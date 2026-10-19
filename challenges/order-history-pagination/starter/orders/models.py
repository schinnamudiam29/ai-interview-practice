from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Order:
    id: str
    customer_id: str
    created_at: datetime
    total_cents: int
    status: str = "paid"
