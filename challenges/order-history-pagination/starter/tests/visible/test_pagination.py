import unittest
from datetime import datetime, timedelta

from orders import InMemoryOrderStore, Order, OrderHistoryService

T0 = datetime(2026, 3, 1, 9, 0, 0)


def make_service(orders):
    store = InMemoryOrderStore()
    for o in orders:
        store.add(o)
    return OrderHistoryService(store)


def collect_all(service, customer_id, limit):
    seen, cursor = [], None
    for _ in range(100):  # guard against infinite loops
        page = service.get_page(customer_id, limit=limit, cursor=cursor)
        seen.extend(o.id for o in page.items)
        cursor = page.next_cursor
        if cursor is None:
            return seen
    raise AssertionError("pagination never terminated")


class FirstPageTests(unittest.TestCase):
    def test_first_page_is_oldest_orders(self):
        service = make_service(
            [Order(f"o{i}", "c1", T0 + timedelta(minutes=i), 1000 + i) for i in range(5)]
        )
        page = service.get_page("c1", limit=2)
        self.assertEqual([o.id for o in page.items], ["o0", "o1"])
        self.assertIsNotNone(page.next_cursor)

    def test_only_returns_this_customers_orders(self):
        service = make_service(
            [
                Order("a1", "c1", T0, 500),
                Order("b1", "c2", T0 + timedelta(minutes=1), 700),
            ]
        )
        page = service.get_page("c1", limit=10)
        self.assertEqual([o.id for o in page.items], ["a1"])


class WalkAllPagesTests(unittest.TestCase):
    def test_distinct_timestamps_each_order_once(self):
        orders = [Order(f"o{i}", "c1", T0 + timedelta(minutes=i), 100) for i in range(7)]
        service = make_service(orders)
        self.assertEqual(collect_all(service, "c1", limit=3), [o.id for o in orders])

    def test_orders_placed_in_same_second_each_appear_once(self):
        # Checkout retries and bulk imports regularly create orders with the
        # same created_at. Customers reported orders "disappearing" from the
        # history page when this happens.
        orders = [
            Order("o1", "c1", T0, 100),
            Order("o2", "c1", T0 + timedelta(seconds=1), 200),
            Order("o3", "c1", T0 + timedelta(seconds=1), 300),
            Order("o4", "c1", T0 + timedelta(seconds=2), 400),
            Order("o5", "c1", T0 + timedelta(seconds=3), 500),
        ]
        service = make_service(orders)
        seen = collect_all(service, "c1", limit=2)
        self.assertCountEqual(seen, ["o1", "o2", "o3", "o4", "o5"])
        self.assertEqual(len(seen), len(set(seen)), f"duplicates in {seen}")


if __name__ == "__main__":
    unittest.main()
