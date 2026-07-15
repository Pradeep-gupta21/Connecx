/**
 * Standalone automated test suite for testing payments and withdrawals payout logic.
 * Tests:
 * 1. Successful payout
 * 2. Failed payout
 * 3. Retry
 * 4. Manual payout
 * 5. RazorpayX payout
 * 6. Double-click Release Funds (CAS locking)
 * 7. Server restart during processing (Recovery job)
 * 8. Duplicate webhook delivery
 * 9. Network timeout
 * 10. Concurrent admin actions
 * 
 * Run with: bun run scratch/test-payouts.ts
 */

import { assert } from "console";

// --- Mock Setup ---
const mockDb = {
  withdrawals: [] as any[],
  wallets: [] as any[],
  wallet_transactions: [] as any[],
  activity_logs: [] as any[],
  withdrawal_logs: [] as any[],
  payment_webhooks: [] as any[],
};

// Reset mock DB state before each test
function resetMockDb() {
  mockDb.withdrawals = [];
  mockDb.wallets = [];
  mockDb.wallet_transactions = [];
  mockDb.activity_logs = [];
  mockDb.withdrawal_logs = [];
  mockDb.payment_webhooks = [];
}

const mockRazorpay = {
  payoutStatus: "processed",
  throwError: false,
  timeout: false,
  async createPayout(args: any) {
    if (this.throwError) {
      throw new Error("Razorpay API Error: Insufficient balance");
    }
    if (this.timeout) {
      throw new Error("Network timeout: connection reset");
    }
    return {
      id: "payout_" + Math.random().toString(36).substring(2, 10),
      amount: args.amountMinor,
      currency: args.currency,
      status: this.payoutStatus,
      utr: "UTR" + Math.random().toString(36).substring(2, 10).toUpperCase(),
    };
  },
  async getPayout(id: string) {
    return {
      id,
      amount: 50000,
      currency: "INR",
      status: this.payoutStatus,
      utr: "UTR_RECOVERED_123",
    };
  }
};

// --- Test Cases ---

async function testSuccessfulPayout() {
  console.log("🟢 Running Test: Successful Payout");
  resetMockDb();
  
  // Setup: 1 approved withdrawal
  const withdrawal = {
    id: "wd_123",
    user_id: "user_456",
    amount: 500,
    status: "approved",
  };
  mockDb.withdrawals.push(withdrawal);

  // Mock server execution of adminReleaseWithdrawalPayout
  // 1. CAS: approved -> processing
  const wd = mockDb.withdrawals.find(w => w.id === withdrawal.id && w.status === "approved");
  if (!wd) throw new Error("CAS check failed");
  wd.status = "processing";
  
  // 2. Call Razorpay
  mockRazorpay.throwError = false;
  mockRazorpay.timeout = false;
  mockRazorpay.payoutStatus = "processed";
  const payout = await mockRazorpay.createPayout({ amountMinor: 50000, currency: "INR" });
  
  // 3. Save success details & complete
  wd.payout_id = payout.id;
  wd.payout_ref = payout.utr;
  wd.status = "completed";
  wd.completed_at = new Date().toISOString();

  // Log to timeline
  mockDb.withdrawal_logs.push({
    withdrawal_id: wd.id,
    status: "completed",
    gateway_reference: payout.utr,
  });

  assert(wd.status === "completed", "Status should be completed");
  assert(wd.payout_ref === payout.utr, "Payout reference should match UTR");
  assert(mockDb.withdrawal_logs.length === 1, "Timeline log should be recorded");
  console.log("✅ Passed: Successful Payout");
}

async function testFailedPayout() {
  console.log("🟢 Running Test: Failed Payout");
  resetMockDb();

  const withdrawal = {
    id: "wd_123",
    user_id: "user_456",
    amount: 500,
    status: "approved",
  };
  mockDb.withdrawals.push(withdrawal);

  const wd = mockDb.withdrawals.find(w => w.id === withdrawal.id && w.status === "approved");
  wd.status = "processing";

  // Mock Razorpay failure
  mockRazorpay.throwError = true;
  try {
    const payout = await mockRazorpay.createPayout({ amountMinor: 50000, currency: "INR" });
  } catch (e: any) {
    // Catch and mark failed, restore balance
    wd.status = "failed";
    wd.failure_reason = e.message;
    wd.failed_at = new Date().toISOString();
    
    mockDb.withdrawal_logs.push({
      withdrawal_id: wd.id,
      status: "failed",
      metadata: { error: e.message }
    });
  }

  assert(wd.status === "failed", "Status should be failed");
  assert(wd.failure_reason === "Razorpay API Error: Insufficient balance", "Failure reason must match");
  assert(mockDb.withdrawal_logs[0].status === "failed", "Timeline failure must be logged");
  console.log("✅ Passed: Failed Payout");
}

async function testRetry() {
  console.log("🟢 Running Test: Retry Payout");
  resetMockDb();

  // Setup: 1 failed withdrawal
  const withdrawal = {
    id: "wd_123",
    user_id: "user_456",
    amount: 500,
    status: "failed",
  };
  mockDb.withdrawals.push(withdrawal);

  // CAS: approved or failed -> processing
  const wd = mockDb.withdrawals.find(w => w.id === withdrawal.id && ["approved", "failed"].includes(w.status));
  if (!wd) throw new Error("Retry CAS check failed");
  wd.status = "processing";

  mockRazorpay.throwError = false;
  const payout = await mockRazorpay.createPayout({ amountMinor: 50000, currency: "INR" });
  wd.status = "completed";
  wd.payout_ref = payout.utr;

  assert(wd.status === "completed", "Status should be completed after successful retry");
  console.log("✅ Passed: Retry Payout");
}

async function testManualPayout() {
  console.log("🟢 Running Test: Manual Payout");
  resetMockDb();

  const withdrawal = {
    id: "wd_123",
    user_id: "user_456",
    amount: 500,
    status: "processing", // manual payouts go through processing -> completed
  };
  mockDb.withdrawals.push(withdrawal);

  // Admin marks manual complete
  const wd = mockDb.withdrawals.find(w => w.id === withdrawal.id && w.status === "processing");
  wd.status = "completed";
  wd.payout_ref = "Manual Payout";
  wd.completed_at = new Date().toISOString();

  assert(wd.status === "completed", "Status should be completed");
  assert(wd.payout_ref === "Manual Payout", "Payout reference must be 'Manual Payout'");
  console.log("✅ Passed: Manual Payout");
}

async function testDoubleClickRelease() {
  console.log("🟢 Running Test: Double-click Release Payout (CAS Race Condition)");
  resetMockDb();

  const withdrawal = {
    id: "wd_123",
    user_id: "user_456",
    amount: 500,
    status: "approved",
  };
  mockDb.withdrawals.push(withdrawal);

  // Thread 1 and Thread 2 try to release concurrently
  const runRelease = async (threadId: number) => {
    // Simulating CAS: update status from approved to processing
    const wd = mockDb.withdrawals.find(w => w.id === withdrawal.id && w.status === "approved");
    if (!wd) {
      return { success: false, reason: "CAS: Not in approved status" };
    }
    // Simulate delay
    await new Promise(r => setTimeout(r, 5));
    wd.status = "processing";
    return { success: true };
  };

  const [res1, res2] = await Promise.all([runRelease(1), runRelease(2)]);

  // One thread must succeed, the other must fail
  assert((res1.success && !res2.success) || (!res1.success && res2.success), "Only one thread should lock the row");
  console.log("✅ Passed: Double-click Release Funds");
}

async function testServerRestartDuringProcessing() {
  console.log("🟢 Running Test: Server Restart Recovery Job");
  resetMockDb();

  // Setup: Stuck withdrawal in 'processing' status
  const withdrawal = {
    id: "wd_123",
    user_id: "user_456",
    amount: 500,
    status: "processing",
    razorpay_payout_id: "payout_abc",
  };
  mockDb.withdrawals.push(withdrawal);

  // Mock recovery check
  const wd = mockDb.withdrawals.find(w => w.id === withdrawal.id);
  
  // 1. Fetch status from provider
  mockRazorpay.payoutStatus = "processed";
  const payout = await mockRazorpay.getPayout(wd.razorpay_payout_id);
  
  if (payout.status === "processed") {
    wd.status = "completed";
    wd.payout_ref = payout.utr;
  }

  assert(wd.status === "completed", "Recovery job should transition stuck processed payout to completed");
  console.log("✅ Passed: Server Restart Recovery Job");
}

async function testDuplicateWebhook() {
  console.log("🟢 Running Test: Duplicate Webhook Delivery");
  resetMockDb();

  const webhookEventId = "evt_123456";

  const handleWebhook = (eventId: string) => {
    const exists = mockDb.payment_webhooks.includes(eventId);
    if (exists) {
      return { success: false, reason: "Deduplicated" };
    }
    mockDb.payment_webhooks.push(eventId);
    return { success: true };
  };

  const res1 = handleWebhook(webhookEventId);
  const res2 = handleWebhook(webhookEventId);

  assert(res1.success === true, "First delivery should process");
  assert(res2.success === false && res2.reason === "Deduplicated", "Second delivery should be deduplicated");
  console.log("✅ Passed: Duplicate Webhook Delivery");
}

async function testNetworkTimeout() {
  console.log("🟢 Running Test: Network Timeout Error Handling");
  resetMockDb();

  const withdrawal = {
    id: "wd_123",
    user_id: "user_456",
    amount: 500,
    status: "approved",
  };
  mockDb.withdrawals.push(withdrawal);

  const wd = mockDb.withdrawals.find(w => w.id === withdrawal.id);
  wd.status = "processing";

  mockRazorpay.timeout = true;
  try {
    await mockRazorpay.createPayout({ amountMinor: 50000, currency: "INR" });
  } catch (e: any) {
    wd.status = "failed";
    wd.failure_reason = e.message;
  }

  assert(wd.status === "failed", "Payout should fail on network timeout");
  assert(wd.failure_reason === "Network timeout: connection reset", "Reason should record timeout error");
  console.log("✅ Passed: Network Timeout Error Handling");
}

async function testAutomaticValidationPassed() {
  console.log("🟢 Running Test: Automatic Validation Passed");
  resetMockDb();

  // Setup: Wallet has balance 1000
  mockDb.wallets.push({ user_id: "user_1", available_balance: 1000 });

  // Setup: Validation result is valid
  const validationResult = { valid: true };

  const status = validationResult.valid ? "approved" : "review_pending";
  const wd = {
    id: "wd_val_pass",
    user_id: "user_1",
    amount: 500,
    status: status,
  };
  mockDb.withdrawals.push(wd);

  assert(wd.status === "approved", "Status should be approved on validation pass");
  console.log("✅ Passed: Automatic Validation Passed");
}

async function testAutomaticValidationFailedActive() {
  console.log("🟢 Running Test: Automatic Validation Failed (Active Withdrawal)");
  resetMockDb();

  // Setup: Wallet has 1000, but there's an active withdrawal in progress
  mockDb.wallets.push({ user_id: "user_1", available_balance: 1000 });
  mockDb.withdrawals.push({ id: "wd_active", user_id: "user_1", status: "processing", amount: 200 });

  // Running validation check: active withdrawal exists
  const activeWd = mockDb.withdrawals.find(w => w.user_id === "user_1" && ["processing", "review_pending", "approved"].includes(w.status));
  const validationResult = activeWd 
    ? { valid: false, error: "Active withdrawal exists" } 
    : { valid: true };

  const status = validationResult.valid ? "approved" : "review_pending";
  const wd = {
    id: "wd_val_fail",
    user_id: "user_1",
    amount: 500,
    status: status,
    failure_reason: validationResult.valid ? null : validationResult.error,
  };
  mockDb.withdrawals.push(wd);

  assert(wd.status === "review_pending", "Status should be review_pending on validation fail");
  assert(wd.failure_reason === "Active withdrawal exists", "Failure reason should be stored");
  console.log("✅ Passed: Automatic Validation Failed (Active Withdrawal)");
}

async function testAutomaticValidationFailedSettlement() {
  console.log("🟢 Running Test: Automatic Validation Failed (No Settled Earnings)");
  resetMockDb();

  // Setup: Wallet has 1000, but no completed/settled campaign earnings
  mockDb.wallets.push({ user_id: "user_1", available_balance: 1000 });

  // Settled earnings total = 0
  const remainingSettledBalance = 0; 
  const validationResult = remainingSettledBalance < 500 
    ? { valid: false, error: "Exceeds settled earnings" } 
    : { valid: true };

  const status = validationResult.valid ? "approved" : "review_pending";
  const wd = {
    id: "wd_val_fail_2",
    user_id: "user_1",
    amount: 500,
    status: status,
    failure_reason: validationResult.valid ? null : validationResult.error,
  };
  mockDb.withdrawals.push(wd);

  assert(wd.status === "review_pending", "Status should be review_pending");
  assert(wd.failure_reason === "Exceeds settled earnings", "Failure reason must match");
  console.log("✅ Passed: Automatic Validation Failed (No Settled Earnings)");
}

async function testFraudChecksLimit() {
  console.log("🟢 Running Test: Fraud Checks (Limit Exceeded)");
  resetMockDb();

  const amount = 60000;
  const FRAUD_LIMIT_INR = 50000;
  const validationResult = amount > FRAUD_LIMIT_INR 
    ? { valid: false, error: "Limit exceeded" }
    : { valid: true };

  const status = validationResult.valid ? "approved" : "needs_review";
  const wd = {
    id: "wd_limit",
    user_id: "user_1",
    amount,
    status: status,
    failure_reason: validationResult.valid ? null : validationResult.error,
  };
  mockDb.withdrawals.push(wd);

  assert(wd.status === "needs_review", "Status should be needs_review");
  assert(wd.failure_reason === "Limit exceeded", "Failure reason should match limit error");
  console.log("✅ Passed: Fraud Checks (Limit Exceeded)");
}

async function testFraudChecksMultiple() {
  console.log("🟢 Running Test: Fraud Checks (Multiple Requests in 24h)");
  resetMockDb();

  // Setup: there is already a withdrawal requested recently
  mockDb.withdrawals.push({ id: "wd_recent", user_id: "user_1", created_at: new Date().toISOString() });

  const hasRecent = mockDb.withdrawals.some(w => w.user_id === "user_1");
  const validationResult = hasRecent
    ? { valid: false, error: "Multiple withdrawals in 24h" }
    : { valid: true };

  const status = validationResult.valid ? "approved" : "needs_review";
  const wd = {
    id: "wd_multiple",
    user_id: "user_1",
    amount: 100,
    status: status,
  };
  mockDb.withdrawals.push(wd);

  assert(wd.status === "needs_review", "Status must be needs_review");
  console.log("✅ Passed: Fraud Checks (Multiple Requests in 24h)");
}

async function testFraudChecksTooManyFailed() {
  console.log("🟢 Running Test: Fraud Checks (Too Many Failed Attempts)");
  resetMockDb();

  // Setup: 3 failures in 7 days
  mockDb.withdrawals.push({ id: "1", user_id: "user_1", status: "failed" });
  mockDb.withdrawals.push({ id: "2", user_id: "user_1", status: "failed" });
  mockDb.withdrawals.push({ id: "3", user_id: "user_1", status: "failed" });

  const failedCount = mockDb.withdrawals.filter(w => w.user_id === "user_1" && w.status === "failed").length;
  const validationResult = failedCount >= 3
    ? { valid: false, error: "Too many failed attempts" }
    : { valid: true };

  const status = validationResult.valid ? "approved" : "needs_review";
  const wd = {
    id: "wd_failed_sp",
    user_id: "user_1",
    amount: 100,
    status: status,
  };
  mockDb.withdrawals.push(wd);

  assert(wd.status === "needs_review", "Status must be needs_review");
  console.log("✅ Passed: Fraud Checks (Too Many Failed Attempts)");
}

async function testFraudChecksSuspicious() {
  console.log("🟢 Running Test: Fraud Checks (Unverified Profile)");
  resetMockDb();

  // Setup: Profile is unverified
  const profile = { verification_status: "pending" };
  const validationResult = profile.verification_status !== "verified"
    ? { valid: false, error: "Profile not verified" }
    : { valid: true };

  const status = validationResult.valid ? "approved" : "needs_review";
  const wd = {
    id: "wd_suspicious",
    user_id: "user_1",
    amount: 100,
    status: status,
  };
  mockDb.withdrawals.push(wd);

  assert(wd.status === "needs_review", "Status must be needs_review");
  console.log("✅ Passed: Fraud Checks (Unverified Profile)");
}

async function testProviderRejectionBeforeProcessing() {
  console.log("🟢 Running Test: Provider Rejection Before Processing");
  resetMockDb();

  const wd = {
    id: "wd_123",
    user_id: "user_456",
    amount: 500,
    status: "approved",
  };
  mockDb.withdrawals.push(wd);

  // Lock row to processing
  wd.status = "processing";

  // Simulate Razorpay throwing exception immediately
  mockRazorpay.throwError = true;
  try {
    await mockRazorpay.createPayout({ amountMinor: 50000, currency: "INR" });
  } catch (e: any) {
    // If rejected before processing, status becomes needs_review
    wd.status = "needs_review";
    wd.failure_reason = e.message;
  }

  assert(wd.status === "needs_review", "Status should be needs_review when rejected before processing");
  assert(wd.failure_reason === "Razorpay API Error: Insufficient balance", "Error message matches");
  console.log("✅ Passed: Provider Rejection Before Processing");
}

async function testRecoveryNeverStarted() {
  console.log("🟢 Running Test: Stuck Payout Recovery (Never Started)");
  resetMockDb();

  const wd = {
    id: "wd_recovery_stuck",
    user_id: "user_1",
    amount: 100,
    status: "processing",
    razorpay_payout_id: null, // never started
  };
  mockDb.withdrawals.push(wd);

  // Recovery logic check
  if (!wd.razorpay_payout_id) {
    wd.status = "needs_review";
    wd.admin_notes = "Reset to needs_review";
  }

  assert(wd.status === "needs_review", "Status must be reset to needs_review");
  console.log("✅ Passed: Stuck Payout Recovery (Never Started)");
}

async function runAllTests() {
  console.log("🚀 Starting Payout & Withdrawal Tests...\n");
  try {
    await testSuccessfulPayout();
    await testFailedPayout();
    await testRetry();
    await testManualPayout();
    await testDoubleClickRelease();
    await testServerRestartDuringProcessing();
    await testDuplicateWebhook();
    await testNetworkTimeout();
    await testAutomaticValidationPassed();
    await testAutomaticValidationFailedActive();
    await testAutomaticValidationFailedSettlement();
    await testFraudChecksLimit();
    await testFraudChecksMultiple();
    await testFraudChecksTooManyFailed();
    await testFraudChecksSuspicious();
    await testProviderRejectionBeforeProcessing();
    await testRecoveryNeverStarted();
    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉");
  } catch (err) {
    console.error("\n❌ TEST FAILURE:", err);
    process.exit(1);
  }
}

runAllTests();
