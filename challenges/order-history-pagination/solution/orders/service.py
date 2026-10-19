from dataclasses import dataclass
from typing import List, Optional

from .cursor import DIRECTIONS, decode_cursor, encode_cursor
from .models import Order
from .store import InMemoryOrderStore


@dataclass
class Page:
    items: List[Order]
    next_cursor: Optional[str]


def _key(o: Order):
    # created_at alone is not unique; id breaks ties deterministically.
    return (o.created_at, o.id)


class OrderHistoryService:
    def __init__(self, store: InMemoryOrderStore) -> None:
        self.store = store

    def get_page(
        self,
        customer_id: str,
        limit: int = 20,
        cursor: Optional[str] = None,
        order: str = "asc",
    ) -> Page:
        """Return one page of a customer's orders, oldest first.

        Contract:
        - Pass the returned next_cursor back in to get the following page.
        - Walking every page yields each order exactly once.
        - Orders with the same created_at come back in a stable order.
        - next_cursor is None when there are no more orders.
        - A malformed cursor raises ValueError.
        """
        if order not in DIRECTIONS:
            raise ValueError(f"order must be one of {DIRECTIONS}")
        descending = order == "desc"
        orders = sorted(self.store.for_customer(customer_id), key=_key, reverse=descending)

        if cursor is not None:
            ts, last_id, direction = decode_cursor(cursor)
            if direction != order:
                raise ValueError("cursor was issued for a different order")
            boundary = (ts, last_id)
            if descending:
                orders = [o for o in orders if _key(o) < boundary]
            else:
                orders = [o for o in orders if _key(o) > boundary]

        # Fetch one extra row to know whether another page exists.
        window = orders[: limit + 1]
        items = window[:limit]
        next_cursor = None
        if len(window) > limit:
            last = items[-1]
            next_cursor = encode_cursor(last.created_at, last.id, order)
        return Page(items=items, next_cursor=next_cursor)
