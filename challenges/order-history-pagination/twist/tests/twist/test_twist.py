"""Follow-up requirement: newest-first ordering."""

import unittest
from datetime import datetime, timedelta

from orders import InMemoryOrderStore, Order, OrderHistoryService
from orders.api import list_orders

T0 = datetime(2026, 7, 4, 12, 0, 0)


def make_service(orders):
    store = InMemoryOrderStore()
    for o in orders:
        store.add(o)
    return OrderHistoryService(store)


def walk(service, customer_id, limit, order):
    flat, cursor = [], None
    for _ in range(200):
        page = service.get_page(customer_id, limit=limit, cursor=cursor, order=order)
        flat.extend(o.id for o in page.items)
        cursor = page.next_cursor
        if cursor is None:
            return flat
    raise AssertionError("pagination never terminated")


class NewestFirst(unittest.TestCase):
    def setUp(self):
        self.orders = [
            Order(f"o{i:02d}", "c1", T0 + timedelta(seconds=i // 3), 1) for i in range(10)
        ]
        self.service = make_service(self.orders)

    def test_desc_is_exact_reverse_of_asc(self):
        asc = walk(self.service, "c1", 3, "asc")
        desc = walk(self.service, "c1", 3, "desc")
        self.assertEqual(asc, [o.id for o in self.orders])
        self.assertEqual(desc, list(reversed(asc)))

    def test_desc_with_limit_one(self):
        desc = walk(self.service, "c1", 1, "desc")
        self.assertEqual(desc, [f"o{i:02d}" for i in reversed(range(10))])

    def test_default_is_still_oldest_first(self):
        page = self.service.get_page("c1", limit=2)
        self.assertEqual([o.id for o in page.items], ["o00", "o01"])

    def test_unknown_order_value_is_rejected(self):
        with self.assertRaises(ValueError):
            self.service.get_page("c1", limit=2, order="sideways")


class NewestFirstApi(unittest.TestCase):
    def setUp(self):
        self.service = make_service(
            [Order(f"o{i}", "c1", T0 + timedelta(minutes=i), 1) for i in range(5)]
        )

    def test_api_accepts_order_param(self):
        status, body = list_orders(self.service, "c1", {"order": "desc", "limit": "2"})
        self.assertEqual(status, 200)
        self.assertEqual([o["id"] for o in body["orders"]], ["o4", "o3"])
        status, body = list_orders(
            self.service, "c1", {"order": "desc", "limit": "2", "cursor": body["next_cursor"]}
        )
        self.assertEqual([o["id"] for o in body["orders"]], ["o2", "o1"])

    def test_api_rejects_bad_order(self):
        status, body = list_orders(self.service, "c1", {"order": "random"})
        self.assertEqual(status, 400)
        self.assertIn("error", body)

    def test_cursor_from_other_direction_is_rejected(self):
        _, body = list_orders(self.service, "c1", {"order": "asc", "limit": "2"})
        status, _ = list_orders(
            self.service, "c1", {"order": "desc", "limit": "2", "cursor": body["next_cursor"]}
        )
        self.assertEqual(status, 400)


if __name__ == "__main__":
    unittest.main()
