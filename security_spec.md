# Security Specification — Aqsa Business Management System

## 1. Data Invariants
1. Every document in `/workspaces/{workspaceId}` and its subcollections (`settings`, `inventory`, `purchases`, `sales`, `returns`, `payments`, `reminders`, `staff`) MUST have an `ownerId` matching `request.auth.uid` (unless operated by the verified bootstrapped admin).
2. All document IDs (`workspaceId`, `settingId`, `itemId`, `purchaseId`, `saleId`, `returnId`, `paymentId`, `reminderId`, `staffId`) MUST match `^[a-zA-Z0-9_\-]+$` and be `<= 128` characters.
3. All writes MUST verify `request.auth != null && request.auth.token.email_verified == true`.
4. All strings MUST enforce bounded `.size()` limits to prevent resource exhaustion.
5. `createdAt` and `updatedAt` MUST match `request.time` on creation; `updatedAt` MUST match `request.time` on update while `createdAt` and `ownerId` remain immutable.
6. `allow list` queries MUST evaluate `resource.data.ownerId == request.auth.uid || isBootstrappedAdmin()` directly without calling `get()` or `exists()`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/write**: `request.auth == null` on `/workspaces/ws1/inventory/item1`.
2. **Unverified email write**: `request.auth.token.email_verified == false` claiming admin email `ahmer.iqbal.khan@gmail.com`.
3. **Identity spoofing on create**: Authenticated user `uid_A` creates inventory doc with `ownerId: "uid_B"`.
4. **Ghost/shadow field injection**: Payload includes undeclared `isSuperAdmin: true` rejected by `keys().hasOnly(...)`.
5. **ID poisoning (1.5KB path ID)**: Document ID exceeding 128 chars or containing invalid symbols (`../`, spaces).
6. **Cross-tenant list scraping**: User `uid_B` attempts `list` query on `/workspaces/uid_A/sales` without `where('ownerId', '==', 'uid_B')`.
7. **Immortal field mutation**: Update attempts to change `ownerId` or `createdAt` on an existing `SalesOrder`.
8. **Client timestamp forgery**: Create payload sends custom past `createdAt` instead of `request.time`.
9. **Type poisoning**: `SalesOrder.finalTotal` sent as string `"free"` instead of `number`.
10. **Currency enum bypass**: `InventoryItem.costCurrency` set to `"BTC"` instead of `['RMB', 'USD', 'PKR']`.
11. **Oversized string payload (Denial of Wallet)**: `notes` or `itemsPayload` exceeding max size limits.
12. **Role self-escalation**: Non-admin user attempts to write to `/admins/{uid}` directly.
