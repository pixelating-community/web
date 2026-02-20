import { sql } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { getStripe } from "@/lib/getStripe";

export const addCollectionSession = async ({
  collectionId,
  perspectiveId,
}: {
  collectionId: string;
  perspectiveId: string;
}) => {
  const rows = await sql`
    SELECT t.name as topic_name
    FROM perspectives p
    JOIN topics t ON t.id = p.topic_id
    WHERE p.id = ${perspectiveId}
    LIMIT 1;
  `;

  const topicName = rows[0]?.topic_name ?? "topic";
  const baseUrl = getServerEnv("APP_BASE_URL");
  if (!baseUrl) {
    throw new Error("APP_BASE_URL is required for Stripe checkout URLs.");
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Reflect on /t/${topicName}`,
            description: `Perspective: ${perspectiveId}\n${baseUrl}/p/${perspectiveId}`,
          },
          unit_amount: 100,
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/p/${perspectiveId}/s?session_id={CHECKOUT_SESSION_ID}`,
    payment_intent_data: {
      metadata: { collectionId, perspectiveId },
    },
    metadata: { collectionId, perspectiveId },
  });

  return { url: session.url };
};
