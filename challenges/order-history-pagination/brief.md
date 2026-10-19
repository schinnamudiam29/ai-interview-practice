# Orders keep disappearing from order history

**Support ticket #4412:** "I placed three orders during the flash sale and only two show up in my order history. The third one is in my email receipts though."

The order history page calls `GET /customers/{id}/orders`, which uses cursor pagination (`orders/api.py` → `orders/service.py`). Engineering confirmed the order exists in the database. It just never appears on any page.

## Your task

1. Find out why orders go missing and fix it. One visible test already reproduces the report.
2. The endpoint's contract (in `service.py` and `api.py` docstrings) must hold:
   - Walking all pages returns **every order exactly once**, oldest first.
   - Orders with the same `created_at` come back in a **stable, deterministic order**.
   - `next_cursor` is `None` when there are no more orders — clients should never need to fetch an empty page.
   - Any malformed cursor returns **400**, never a server error.
3. Don't change the public function signatures; other teams call them.

## How you'll be assessed

Hidden tests check the edge cases above. After you submit, a follow-up requirement will arrive. At the end you'll write a short explanation of the root cause and your fix.

## Running tests

Click **Run** to run the visible tests (`tests/visible`). You can add your own test files there too.
