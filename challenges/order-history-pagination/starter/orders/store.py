from typing import Dict, List

from .models import Order


class InMemoryOrderStore:
    """Stand-in for the orders table. Returns rows in insertion order, like a
    table scan with no ORDER BY would."""

    def __init__(self) -> None:
        self._orders: Dict[str, Order] = {}

    def add(self, order: Order) -> None:
        if order.id in self._orders:
            raise ValueError(f"duplicate order id {order.id}")
        self._orders[order.id] = order

    def for_customer(self, customer_id: str) -> List[Order]:
        return [o for o in self._orders.values() if o.customer_id == customer_id]
