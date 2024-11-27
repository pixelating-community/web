import { getPerspective } from "@/actions";
import { Perspectives } from "@/components/Perspectives";

export default async function Page({ params }) {
  const { id } = params;
  const perspective = await getPerspective(id);
  return (
    <div className="flex flex-col w-4/5 my-0 mx-auto h-dvh">
      <div className="flex grow-0">
        <div className="fixed -translate-x-2/4 -translate-y-2/4 top-1/2 left-1/2">
          <Perspectives perspectives={perspective} />
        </div>
      </div>
    </div>
  );
}
