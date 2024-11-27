import { getPerspectives } from "@/actions/getPerspectives";
import { Perspectives } from "@/components/Perspectives";
import { EmptyState } from "@/components/EmptyState";

export async function GetPerspectives({
  topicId,
  forward = true,
}: {
  topicId: string;
  forward?: boolean;
}) {
  const perspectives = (await getPerspectives({ topicId, forward })) || [];
  return (
    <>
      {perspectives.length > 0 ? (
        <Perspectives perspectives={perspectives} />
      ) : (
        <EmptyState />
      )}
    </>
  );
}
