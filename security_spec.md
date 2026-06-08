# Security Specification - ShopEasy

## 1. Data Invariants

1. **Products (`/products/{productId}`)**:
   - Read-only for all users (authenticated & unauthenticated).
   - Creation/modification forbidden for standard clients (preventing catalog pollution).
   - Document ID must be a valid ID format (`isValidId(productId)`).

2. **Carts (`/carts/{cartId}`)**:
   - Must be created by a signed-in user.
   - `ownerId` must strictly match the current user's UID.
   - `ownerEmail` must match the authenticated user's email.
   - `name` must be a string up to 100 characters.
   - `createdAt` and `updatedAt` must be set to the server timestamp (`request.time`).
   - Carts can be read, updated (e.g. name), or deleted by members (owner or collaborators).

3. **CartItems (`/carts/{cartId}/items/{itemId}`)**:
   - Belongs to a specific parent cart document.
   - Any signed-in user can add items if they have access to the parent cart.
   - `id` and `itemId` must be valid formats.
   - `productName` must be a string (1-100 characters).
   - `price` must be a positive number.
   - `quantity` must be an integer (1 to 1000).
   - `addedBy` must strictly match the current user's UID (`request.auth.uid`).
   - `addedAt` must equal the server time `request.time`.
   - `completed` must be a boolean.

---

## 2. The "Dirty Dozen" Payloads (Threat Vectors)

1. **Unauthenticated Cart Creation**: Trying to create a cart without signing in.
2. **Cart Owner Spoofing**: Attempting to create a cart with `ownerId` of another user.
3. **Product Catalog Pollution**: Writing directly to the public `/products` collection.
4. **Junk Document ID Poisoning**: Creating a cart or item with a 10KB string as the ID.
5. **Negative Prices**: Adding an item to the cart with a negative price (e.g., -$100).
6. **Self-Generated Cart Date**: Setting `createdAt` to a backdated time in the past instead of `request.time`.
7. **Negative or Massive Quantity**: Setting `quantity` to `-5` or `99999999`.
8. **Item Identity Spoofing**: Adding an item with `addedBy` belonging to another user.
9. **Post-Completion Lock-Breaking**: Overwriting historic completed cart items with custom, fraudulent metadata.
10. **Shadow Key Injection**: Injecting unsupported fields like `{ isAd: true, discountPrice: 0.1 }` on items to bypass standard billing logic.
11. **Malicious Cart Title**: Setting `name` to a script-tag string for XSS, or an infinite string to blow database limits.
12. **Cart Read Scraping**: Attempting a query-scraping of all carts across all users without proper indexing.

---

## 3. Test Runner Concept

A testing script would verify that:
- `get` and `list` on Products are allowed.
- `write` on Products is denied for standard users.
- `create` of a Cart with matching `ownerId` and `request.time` succeeds.
- `create` of a Cart with mismatching or spoofed `ownerId` fails.
- `create` of CartItems with correct formats succeeds.
- `create` of CartItems with negative fields or injection fields fails.
