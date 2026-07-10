## Payment flow audit — Connecx

I traced the full end-to-end payment lifecycle (advertiser fund → hold → accept creator → deliverables → release → withdrawal + refunds + webhook) across `src/lib/payments/*`, `src/routes/api/public/razorpay/webhook.ts`, the payment hooks, and DB schema/enums.

### What's healthy
- Signature verification (checkout + webhook) uses HMAC-SHA256 with `timingSafeEqual`.
- Test/live mode guardrails on both server (`PAYMENT_MODE` vs key prefix) and client (order.mode vs keyId prefix).
- Refund state machine uses compare-and-swap on `status='requested'` so two admins can't double-approve.
- Withdrawal same CAS pattern; funds moved out of `available_balance` immediately to prevent double-spend.
- Double-entry ledger with idempotency keys per event.
- Payout method verification gate before withdrawal.
- Webhook is signature-verified and deduped through `payment_webhooks(event_id)`.
- All server functions are `requireSupabaseAuth`-gated; admin mutations double-check `has_role('admin')`.
- Withdrawn-application DB trigger blocks status transitions and contract creation.

### Bugs / gaps found (severity ordered)

**1. CRITICAL — Webhook is not a real safety net for `payment.captured`.**
`webhook.ts` on `payment.captured` only writes `fee`, `tax`, and `razorpay_payment_id`. It does NOT:
- flip `status_v2` to `held`
- set `campaigns.funded / funded_at / funded_payment_id`
- post the escrow / fee / GST ledger entries
- send the "payment successful" / "campaign is live" notifications

Impact: if the browser closes between the Razorpay success callback and the client hitting `verifyPayment` (common on mobile / flaky networks / back-button), Razorpay has captured the money but the campaign is never activated and the payment stays `pending` forever.

**2. HIGH — Refund can over-return via Razorpay but under-reverse in the ledger.**
`createRefund` allows `amount` up to `payments.amount` (total_payable = subtotal + fee + GST), but `markRefundCompleted` only unwinds `min(creator_earnings, refundAmount)` from escrow. If a full refund is filed, Razorpay returns the full total_payable to the advertiser, but the ledger still holds the platform fee + GST as revenue. Correctness / reconciliation bug.

**3. MEDIUM — No handler for `refund.failed` or `payout.failed` webhooks.**
Failed refunds/payouts stay stuck in `processing` forever. Creator's withdrawn funds never come back; refund never rolls back to a resolvable state.

**4. MEDIUM — `fundCampaign` doesn't check campaign lifecycle status.**
A `paused` / `closed` / `deleted` campaign can be funded (only `funded=false` is checked). Should require `status IN ('draft','open')` and `deleted_at IS NULL`.

**5. LOW — `acceptCreator` isn't idempotent on wallet hold.**
Network retries can apply the `hold` wallet txn twice. No idempotency key on `apply_wallet_txn`.

**6. LOW — `payment_webhooks` insert relies on the unique index rejecting duplicates.**
Simultaneous webhook deliveries race — the loser gets a 500 instead of a 200. Should be an upsert on `event_id`.

### Fix plan

**A. Extract a single `finalizeCapture(paymentId, razorpayPaymentId, actorId?)` in `service.server.ts`** that runs all "held" side-effects (status update, campaign funded flag, ledger for escrow/fee/GST, notifications). Have both `verifyAndCapture` (after signature check) and the webhook's `payment.captured` branch call it. Guard with a CAS `.eq('status_v2','pending')` so double-fire is a no-op.

**B. Cap refund amount at `creator_earnings` for `held` payments** (add explicit check in `createRefund`). For a released payment, existing clawback logic already handles the wallet side.
Follow-up option (not in this pass unless approved): also unwind fee/GST revenue on full refunds.

**C. Add webhook handlers for `refund.failed` and `payout.failed`.**
- `refund.failed`: set refunds.status='failed', clear `status_v2='refund_pending'` back to previous, notify requester.
- `payout.failed`: call a new `PaymentService.markWithdrawalFailed(withdrawalId, reason)` that restores wallet balance and posts the reverse ledger entry.

**D. Tighten `fundCampaign` preconditions**: reject when `status NOT IN ('draft','open')` or `deleted_at IS NOT NULL`.

**E. Use upsert on `payment_webhooks(provider,event_id)`** in the webhook handler and treat the "already exists + processed" case as 200.

**F. (Optional, cheap) Add an `idempotency_key` param to `apply_wallet_txn` calls in `acceptCreator`** (`accept:<contractId>:hold`) — requires either a new column or reusing metadata + a pre-select guard.

No DB migration required for A–E; F needs a small SQL change if we want a true unique guard.

### Files to change
- `src/lib/payments/service.server.ts` — new `finalizeCapture` + `markWithdrawalFailed`; refund cap; funding preconditions.
- `src/routes/api/public/razorpay/webhook.ts` — call `finalizeCapture` on `payment.captured`; add `refund.failed` + `payout.failed`; upsert dedupe row.
- (optional) migration for `apply_wallet_txn` idempotency and/or ledger unwind for fee/GST on full refund.

### Verification after fix
- Simulate `payment.captured` webhook with a pending payment row → row becomes `held`, campaign becomes `funded`, ledger has 3 entries, notifications inserted.
- Simulate second identical webhook → no duplicate ledger entries, returns 200.
- File full refund on a `held` payment where `total_payable > creator_earnings` → rejected with clear message.
- Simulate `refund.failed` webhook → refund row moves to `failed`.
- Try funding a `paused` campaign → rejected.

Ready to implement A–E on approval; F only if you want the extra hardening.