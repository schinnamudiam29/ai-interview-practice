from dataclasses import dataclass
from typing import List, Optional

from .cursor import decode_cursor, encode_cursor
from .models import Order
from .store import InMemoryOrderStore


@dataclass
class Page:
    items: List[Order]
    next_cursor: Optional[str]


class OrderHistoryService:
    def __init__(self, store: InMemoryOrderStore) -> None:
        self.store = store

    def get_page(
        self, customer_id: str, limit: int = 20, cursor: Optional[str] = None
    ) -> Page:
        """Return one page of a customer's orders, oldest first.

        Contract:
        - Pass the returned next_cursor back in to get the following page.
        - Walking every page yields each order exactly once.
        - Orders with the same created_at come back in a stable order.
        - next_cursor is None when there are no more orders.
        - A malformed cursor raises ValueError.
        """
        orders = sorted(self.store.for_customer(customer_id), key=lambda o: o.created_at)

        if cursor is not None:
            after = decode_cursor(cursor)
            orders = [o for o in orders if o.created_at > after]

        items = orders[:limit]
        next_cursor = encode_cursor(items[-1].created_at) if len(items) == limit else None
        return Page(items=items, next_cursor=next_cursor)
