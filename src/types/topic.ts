import type { UUID } from "node:crypto";
import type { Perspective } from "@/types/perspectives";

export type TopicPayload = {
  topic: {
    id: UUID;
    name: string;
    shortTitle?: string;
    emoji?: string;
    locked: boolean;
    canAccess: boolean;
    canWrite: boolean;
  };
  perspectives: Perspective[];
  ui?: {
    actionToken?: string;
  };
};

export type TopicPayloadQueryResult = {
  data: TopicPayload | null;
  error: string;
};
