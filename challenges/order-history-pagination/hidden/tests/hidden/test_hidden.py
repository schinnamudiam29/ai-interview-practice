"""Grading tests. Never shown to the user or the model."""

import base64
import json
import unittest
from datetime import datetime, timedelta

from orders import InMemoryOrderStore, Order, OrderHistoryService
from orders.api import list_orders

T0 = datetime(2026, 5, 17, 23, 59, 0)


def make_service(orders):
    store = InMemoryOrderStore()
    for o in orders:
        store.add(o)
    return OrderHistoryService(store)


def walk(service, customer_id, limit):
    pages, cursor = [], None
    for _ in range(200):
        page = service.get_page(customer_id, limit=limit, cursor=cursor)
        pages.append([o.id for o in page.items])
        cursor = page.next_cursor
        if cursor is None:
            return pages
    raise AssertionError("pagination never terminated")


def b64(obj):
    return base64.urlsafe_b64encode(json.dumps(obj).encode()).decode()


class TieHandling(unittest.TestCase):
    def test_all_orders_share_one_timestamp(self):
        ids = ["k3", "k1", "k7", "k2", "k6", "k4", "k5"]
        service = make_service([Order(i, "c9", T0, 10) for i in ids])
        flat = [i for page in walk(service, "c9", 3) for i in page]
        self.assertEqual(len(flat), 7, flat)
        self.assertEqual(sorted(flat), sorted(ids))

    def test_tie_order_is_deterministic_by_id(self):
        # Insertion order must not leak into page order.
        service = make_service(
            [Order("z", "c9", T0, 1), Order("a", "c9", T0, 1), Order("m", "c9", T0, 1)]
        )
        flat = [i for page in walk(service, "c9", 1) for i in page]
        self.assertEqual(flat, ["a", "m", "z"])

    def test_tie_straddles_every_page_boundary(self):
        orders = []
        for i in range(12):
            orders.append(Order(f"p{i:02d}", "c9", T0 + timedelta(seconds=i // 2), 1))
        flat = [i for page in walk(make_service(orders), "c9", 3) for i in page]
        self.assertEqual(flat, [f"p{i:02d}" for i in range(12)])

    def test_limit_one_walks_everything(self):
        orders = [Order(f"q{i}", "c9", T0 + timedelta(seconds=i % 3), 1) for i in range(9)]
        flat = [i for page in walk(make_service(orders), "c9", 1) for i in page]
        self.assertEqual(len(flat), 9)
        self.assertEqual(len(set(flat)), 9)


class LastPage(unittest.TestCase):
    def test_exactly_full_last_page_has_no_cursor(self):
        orders = [Order(f"o{i}", "c1", T0 + timedelta(minutes=i), 1) for i in range(4)]
        pages = walk(make_service(orders), "c1", 2)
        self.assertEqual(pages, [["o0", "o1"], ["o2", "o3"]])

    def test_single_page_exactly_limit(self):
        orders = [Order(f"o{i}", "c1", T0 + timedelta(minutes=i), 1) for i in range(5)]
        page = make_service(orders).get_page("c1", limit=5)
        self.assertEqual(len(page.items), 5)
        self.assertIsNone(page.next_cursor)

    def test_customer_with_no_orders(self):
        page = make_service([Order("x", "other", T0, 1)]).get_page("c1", limit=5)
        self.assertEqual(page.items, [])
        self.assertIsNone(page.next_cursor)


class CursorValidation(unittest.TestCase):
    def setUp(self):
        self.service = make_service([Order(f"o{i}", "c1", T0 + timedelta(minutes=i), 1) for i in range(3)])

    def test_well_formed_json_missing_fields(self):
        status, _ = list_orders(self.service, "c1", {"cursor": b64({"hello": 1})})
        self.assertEqual(status, 400)

    def test_cursor_is_not_json(self):
        status, _ = list_orders(
            self.service, "c1", {"cursor": base64.urlsafe_b64encode(b"\xff\xfe").decode()}
        )
        self.assertEqual(status, 400)

    def test_cursor_round_trip_through_api(self):
        status, body = list_orders(self.service, "c1", {"limit": "2"})
        self.assertEqual(status, 200)
        status, body2 = list_orders(self.service, "c1", {"limit": "2", "cursor": body["next_cursor"]})
        self.assertEqual(status, 200)
        self.assertEqual([o["id"] for o in body2["orders"]], ["o2"])
        self.assertIsNone(body2["next_cursor"])


class Isolation(unittest.TestCase):
    def test_other_customers_with_same_timestamps_do_not_interfere(self):
        orders = []
        for i in range(6):
            orders.append(Order(f"a{i}", "A", T0 + timedelta(seconds=i // 3), 1))
            orders.append(Order(f"b{i}", "B", T0 + timedelta(seconds=i // 3), 1))
        service = make_service(orders)
        flat = [i for page in walk(service, "A", 2) for i in page]
        self.assertEqual(flat, [f"a{i}" for i in range(6)])


if __name__ == "__main__":
    unittest.main()
