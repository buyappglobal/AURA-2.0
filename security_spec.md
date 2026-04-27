# Security Specification - Aura Business

## 1. Data Invariants
- A `display` document must correspond to an existing `user` document.
- Only the owner of a `display` or a `SuperAdmin`/`Sales` user can modify its contents.
- `lastSeen` (heartbeat) updates only modify the `lastSeen` field.
- `pairingCodes` expire after a set time and can only be linked once.
- `modo_manual` in `clientes` can only be changed by the owner or authorized staff.
- PII (email) in `users` must not be publicly accessible via list queries.

## 2. The "Dirty Dozen" Payloads

### P1: Unauthorized Display Update
**Attempt**: User B tries to update User A's display contents.
**Result**: `PERMISSION_DENIED`

### P2: Identity Spoofing (Display)
**Attempt**: User A tries to create a display document for User B (setting `userId` as target).
**Result**: `PERMISSION_DENIED`

### P3: Resource Poisoning (Heartbeat)
**Attempt**: Malicious client tries to send a 1MB string as the `lastSeen` value.
**Result**: `PERMISSION_DENIED` (Strict type and size check)

### P4: State Shortcutting (Pairing)
**Attempt**: A TV attempts to link itself to a client ID without an admin's authorization.
**Result**: `PERMISSION_DENIED` (Update requires authentication and `linkedClientId` field restriction)

### P5: Unauthorized User Scrape
**Attempt**: Unauthenticated user tries to list all `users` to harvest emails.
**Result**: `PERMISSION_DENIED` (Listing requires specific query constraints or admin role)

### P6: Privilege Escalation
**Attempt**: A `client` role user tries to update their own `role` to `admin`.
**Result**: `PERMISSION_DENIED` (Role updates restricted to `SuperAdmin`)

### P7: Ghost Field Injection
**Attempt**: User tries to add a `verified: true` field to their display config.
**Result**: `PERMISSION_DENIED` (Strict schema verification via `affectedKeys().hasOnly()`)

### P8: Future Timestamp Poisoning
**Attempt**: User sets `createdAt` to a future date.
**Result**: `PERMISSION_DENIED` (Must match `request.time`)

### P9: Illegal Slug Character
**Attempt**: User tries to set a slug with special characters (e.g., `my!slug`).
**Result**: `PERMISSION_DENIED` (Regex check on slug)

### P10: Deleting Pairing Codes
**Attempt**: Any user tries to delete a pairing code.
**Result**: `PERMISSION_DENIED` (Deletes forbidden for this collection)

### P11: PII Leak via Get
**Attempt**: Unauthenticated user tries to `get()` a specific user document to see their email.
**Result**: `PERMISSION_DENIED` (Only Owner or Admin can read email-containing docs)

### P12: Invalid Enum Value
**Attempt**: Setting `theme` to `unsupported_theme`.
**Result**: `PERMISSION_DENIED` (Enum validation)

## 3. Test Runner (Draft)
The tests will verify that all 12 payloads are blocked and that legitimate operations pass.
