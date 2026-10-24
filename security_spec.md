# ReceiptVault Security Specification (Phase 0 TDD & Red Team Audit)

## 1. Data Invariants
1. **Strict Ownership (`userId == request.auth.uid`)**: Every document in `/users/{userId}`, `/payment_methods/{methodId}`, `/assets/{assetId}`, `/claims/{claimId}`, and `/budgets/{budgetId}` must belong exclusively to the authenticated user with `email_verified == true`.
2. **Immutable Ownership & Creation Time**: `userId` and `createdAt` cannot be modified after creation (`incoming().userId == existing().userId && incoming().createdAt == existing().createdAt`).
3. **Strict Key & Size Boundaries**: Every write operation (`create` and `update`) enforces `hasAll` and `hasOnly` key allowlists, strict string `.size()` limits, and `isValidId()` regex validation (`^[a-zA-Z0-9_\-]+$`).
4. **Terminal State Locking**: Claims in `"Approved"` or `"Denied"` status cannot be modified further.
5. **Query Enforcer**: All `allow list` rules explicitly validate `resource.data.userId == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads (All Must Return `PERMISSION_DENIED`)
1. **Unverified Email Spoof**: Authenticated user with `email_verified: false` attempting to create an Asset.
2. **Cross-User Ownership Spoof**: User A creating an Asset with `userId: "user_B"`.
3. **Shadow Field Injection on Create**: Creating an Asset with extra field `"isAdmin": true`.
4. **Shadow Field Injection on Update**: Updating an Asset with an undeclared field `"bypassWarranty": true`.
5. **Denial-of-Wallet String Overflow**: Creating a Claim with a 10,000-character `diagnosticNotes` string (exceeds `maxLength: 2000`).
6. **ID Poisoning Attack**: Creating a document with a 300-character or special-character document ID.
7. **Ownership Hijack on Update**: Updating `userId` on an existing Asset to transfer ownership.
8. **Timestamp Tampering on Create**: Supplying a forged past or future `createdAt` timestamp instead of `request.time`.
9. **Immutable `createdAt` Mutation on Update**: Changing `createdAt` during an Asset status update.
10. **Terminal State Bypass**: Updating a Claim whose existing status is already `"Approved"`.
11. **Blanket List Scraping**: Running a collection `list` query on `/assets` without filtering `where("userId", "==", request.auth.uid)`.
12. **PII Cross-Read**: User A attempting `get` on `/users/user_B`.

## 3. Red Team Audit Summary
- **Shadow Update Test**: PASS (`hasOnly` enforced on both `create` and `update` action branches).
- **Email Spoofing Test**: PASS (`isVerifiedUser()` checks `request.auth.token.email_verified == true`).
- **PII Blanket Test**: PASS (`/users/{userId}` restricts `get` and `list` strictly to `request.auth.uid == userId`).
- **Query Trust Test**: PASS (`allow list` checks `resource.data.userId == request.auth.uid`).
- **Value Poisoning Test**: PASS (`isValid[Entity](incoming())` wraps every `allow update` block).
