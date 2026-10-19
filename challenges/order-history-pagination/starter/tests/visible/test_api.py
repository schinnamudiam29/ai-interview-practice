import unittest
from datetime import datetime, timedelta

from orders import InMemoryOrderStore, Order, OrderHistoryService
from orders.api import list_orders

T0 = datetime(2026, 3, 1, 9, 0, 0)


def make_service(n):
    store = InMemoryOrderStore()
    for i in range(n):
        store.add(Order(f"o{i}", "c1", T0 + timedelta(minutes=i), 1000 * i))
    return OrderHistoryService(store)


class ListOrdersApiTests(unittest.TestCase):
    def test_default_limit_and_shape(self):
        status, body = list_orders(make_service(3), "c1", {})
        self.assertEqual(status, 200)
        self.assertEqual(len(body["orders"]), 3)
        self.assertEqual(
            body["orders"][0],
            {"id": "o0", "created_at": "2026-03-01T09:00:00", "total_cents": 0, "status": "paid"},
        )

    def test_limit_must_be_positive_integer(self):
        service = make_service(3)
        self.assertEqual(list_orders(service, "c1", {"limit": "0"})[0], 400)
        self.assertEqual(list_orders(service, "c1", {"limit": "abc"})[0], 400)
        self.assertEqual(list_orders(service, "c1", {"limit": "101"})[0], 400)

    def test_garbage_cursor_is_rejected(self):
        status, body = list_orders(make_service(3), "c1", {"cursor": "not-a-cursor"})
        self.assertEqual(status, 400)
        self.assertIn("error", body)


if __name__ == "__main__":
    unittest.main()
