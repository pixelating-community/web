import type { Perspective } from "@/types/perspectives";
import type { TopicPayloadQueryResult } from "@/types/topic";

export const patchTopicPayloadQueryResult = ({
  current,
  updater,
}: {
  current: TopicPayloadQueryResult | undefined;
  updater: (items: Perspective[]) => Perspective[];
}): TopicPayloadQueryResult | undefined => {
  const currentPerspectives = current?.data?.perspectives;
  if (!current?.data || !Array.isArray(currentPerspectives)) {
    return current;
  }

  return {
    ...current,
    data: {
      ...current.data,
      perspectives: updater(currentPerspectives),
    },
  };
};
