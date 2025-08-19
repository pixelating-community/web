export const getStripe = () => {
  const Stripe = require("stripe");
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2025-08-27.basil" });
};
