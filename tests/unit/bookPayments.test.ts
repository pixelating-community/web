import { beforeEach, describe, it, expect, vi } from "vitest";
const { sql, retrieve, intent } = vi.hoisted(() => ({
  sql: Object.assign(vi.fn(), { begin: vi.fn() }),
  retrieve: vi.fn(),
  intent: vi.fn(),
}));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/lib/db.server", () => ({ sql }));
vi.mock("@/lib/stripe.server", () => ({
  getStripePublicConfig: () => ({ enabled: false }),
  getStripeClient: () => ({
    checkout: { sessions: { retrieve } },
    paymentIntents: { retrieve: intent },
  }),
}));
import {
  fulfillBookSession,
  consumeBookLogin,
  processBookWebhook,
} from "@/lib/bookPayments.server";
describe("book fulfillment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sql.begin.mockImplementation((fn) => fn(sql));
  });
  const session = {
    id: "cs_test",
    metadata: { purpose: "book", orderId: "order", readerId: "reader" },
    client_reference_id: "order",
    amount_total: 500,
    currency: "usd",
    payment_status: "paid",
    payment_intent: "pi_test",
  };
  const order = {
    id: "order",
    reader_id: "reader",
    amount_minor: 500,
    session_id: "cs_test",
  };
  it("rejects altered prices before granting access", async () => {
    retrieve.mockResolvedValue({ ...session, amount_total: 100 });
    sql.mockResolvedValueOnce([order]);
    await expect(fulfillBookSession("cs_test")).rejects.toThrow(
      "does not match",
    );
    expect(intent).not.toHaveBeenCalled();
  });
  it("does not fulfill pending payments", async () => {
    retrieve.mockResolvedValue({ ...session, payment_status: "unpaid" });
    sql.mockResolvedValueOnce([order]);
    await fulfillBookSession("cs_test");
    expect(sql).toHaveBeenCalledTimes(1);
  });
  it("reconciles current refunds when a delayed payment event arrives", async () => {
    retrieve.mockResolvedValue(session);
    intent.mockResolvedValue({ latest_charge: { amount_refunded: 500 } });
    sql.mockResolvedValueOnce([order]).mockResolvedValueOnce([]);
    await fulfillBookSession("cs_test");
    expect(intent).toHaveBeenCalledWith("pi_test", {
      expand: ["latest_charge"],
    });
    expect(sql.mock.calls[1]).toContain(500);
  });
  it("rejects expired and already consumed login links", async () => {
    sql.mockResolvedValueOnce([]);
    await expect(consumeBookLogin("expired")).rejects.toThrow(
      "expired or was already used",
    );
    expect(sql).toHaveBeenCalledTimes(1);
  });
  it("ignores events for connected accounts", async () => {
    await processBookWebhook({
      account: "acct_other",
      type: "charge.refunded",
    } as never);
    expect(sql).not.toHaveBeenCalled();
  });
});
