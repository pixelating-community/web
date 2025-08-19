"use server";

import type { UUID } from "node:crypto";
import { getStripe } from "@/lib/getStripe";

export const addCollectionSession = async ({
  collectionId,
  perspectiveId,
}: {
  collectionId: UUID;
  perspectiveId: UUID;
}) => {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `${collectionId}` },
          unit_amount: 100,
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_URL}/p/${perspectiveId}/success`,
    payment_intent_data: {
      metadata: { collectionId, perspectiveId },
    },
    metadata: { collectionId, perspectiveId },
  });

  return { url: session.url };
};
