import { GetPerspectives } from "@/components/GetPerspectives";
import { isLocked } from "@/actions";

export default async function Page({ params }) {
  const { slug } = params;
  const locked = await isLocked(slug);

  return (
    <main className="flex flex-col items-center h-full">
      <div className="flex flex-col justify-between w-full h-full overflow-hidden relative">
        {!locked ? (
          <GetPerspectives topicId={slug} forward={true} />
        ) : (
          <div className="text-center text-2xl">🔒</div>
        )}
      </div>
    </main>
  );
}
