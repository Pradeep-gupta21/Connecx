## Payment flow audit — findings

I traced the full escrow lifecycle (fund → verify → accept creator → deliverables → approve → release → withdraw / refund) against the actual DB schema. Three real blockers and a few smaller issues:

### Blockers

1. **Campaign funding always fails at DB insert.**
   `public.payments.contract_id` is `NOT NULL`, but `PaymentService.createCampaignOrder` inserts the escrow row before any contract exists (contract is only created when a creator is accepted). Every "Fund campaign" click will error at `payments.insert(...)`.
   Fix: migration to make `payments.contract_id` nullable (keep FK + `ON DELETE CASCADE`).

2. **Refunds corrupt the creator wallet when the payment is still HELD.**
   `markRefundCompleted` calls `applyWalletTxn({ type: "refund" })`, which the SQL fn implements as `available_balance -= amount`. But at HELD the creator only has `held_balance`/`pending_balance` from the earlier `hold` — never any `available_balance`. Result: creator's available balance goes negative and the hold is never released.
   Fix: reverse the hold with a direct wallet update (decrement `held_balance` and `pending_balance` by the held amount) inside `markRefundCompleted`, only when the payment was still held. If already released, keep the current `refund` debit against `available_balance`.

3. **`adminRejectWithdrawal` double-credits the creator.**
   `requestWithdrawal` already debits `available_balance` via `type: "withdrawal"` (which also increments `withdrawn_balance`). On rejection we run `type: "adjustment"` (which credits `available_balance`) — good — but we never decrement the `withdrawn_balance` that was bumped at request time. Lifetime "withdrawn" totals drift up forever on every rejection.
   Fix: on reject, restore `available_balance` and decrement `withdrawn_balance` by the same amount in a single wallet update, and log a `wallet_transactions` row for audit.

### Smaller correctness / hygiene fixes

4. **`WithdrawalStatus` union in `src/lib/payments/types.ts` is missing `approved` and `rejected`** (both exist in the DB enum and are set by `adminApproveWithdrawal` / `adminRejectWithdrawal`). Widen the type so status badges and filters render them.

5. **`releasePayment` narrows `status_v2` with a string array but the DB value can be `null`** on legacy rows — throws `Cannot release from null` even when the payment is valid. Treat `null` as "not releasable" with a clearer error, and add a guard in `approveDeliverables` when `contract.payment_id` is null (currently silently skips release and marks the contract completed).

6. **`verifyAndCapture` early-returns `{ status: pay.status_v2 }` when already captured** but does not include `orderId`, so the client `useFundCampaign` hook throws on retry after a double-submit. Make the return shape consistent (`{ paymentId, status }` on both branches — the hook already only reads `paymentId`, but confirm the toast path).

### Out of scope for this pass

- Razorpay webhook signature + idempotency path already looks correct; not changing.
- UI dashboards render correctly against the current data; no UI changes needed for these fixes.

## Changes

1. **Migration** (single call):
   - `ALTER TABLE public.payments ALTER COLUMN contract_id DROP NOT NULL;`
   - No data backfill needed (existing rows already satisfy the constraint).

2. **`src/lib/payments/service.server.ts`**
   - `markRefundCompleted`: branch on payment `status_v2` — if `held`/`revision_requested`, reverse the hold directly on `wallets` (decrement `held_balance` and `pending_balance`); if already `released`, keep the `available_balance` debit. Insert a `wallet_transactions` row in both cases for audit.
   - `adminRejectWithdrawal`: replace the `adjustment` call with an atomic wallet update that both credits `available_balance` and debits `withdrawn_balance`, plus a `wallet_transactions` log row.
   - `releasePayment` / `approveDeliverables`: tighten status guards and surface a clear error when `payment_id` is missing.

3. **`src/lib/payments/types.ts`**
   - Extend `WithdrawalStatus` to include `"approved" | "rejected"`.

4. **Verification**
   - `tsgo` typecheck.
   - `psql` sanity: insert-then-rollback a payment row without `contract_id` to confirm the constraint is gone.
   - Manual click-through of "Fund campaign" in the preview to confirm the Razorpay order is created and the payment row lands with `status_v2 = 'pending'`.

No UI files change. No new dependencies.