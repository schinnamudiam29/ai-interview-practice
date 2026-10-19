## Follow-up: newest first

The mobile team is redesigning the account page and wants the **most recent orders first**.

Add an `order` option:

- `OrderHistoryService.get_page(customer_id, limit, cursor, order="asc")` accepts `"asc"` (oldest first, still the default) or `"desc"` (newest first). Any other value raises `ValueError`.
- `GET /customers/{id}/orders` accepts `?order=asc|desc`. An invalid value returns `400`.
- Paging newest-first must have the same guarantees as before: every order exactly once, stable order for orders with the same timestamp.
- A cursor issued for one direction must not be accepted for the other. Return `400` instead of silently returning a wrong page.

Run your tests, then submit again. Afterwards, write a short explanation of what you changed and why.
