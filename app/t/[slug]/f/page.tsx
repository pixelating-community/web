import { GetPerspectives } from "@/components/GetPerspectives";
import { getQRCode } from "@/actions/getQRCode";
import { isLocked } from "@/actions/isLocked";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return {
    title: `t_${slug}`,
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const locked = await isLocked({ topicId: slug });
  const link = await getQRCode({
    text: `${process.env.NEXT_PUBLIC_URL}/t/${slug}/f`,
  });

  return (
    <main className="flex flex-col items-center h-full">
      <div className="flex flex-col justify-between w-full h-full overflow-hidden relative">
        {!locked ? (
          <>
            <div dangerouslySetInnerHTML={{ __html: link }} />
            <GetPerspectives topicId={slug} forward={true} />
          </>
        ) : (
          <div className="text-center text-2xl">🔒</div>
        )}
      </div>
    </main>
  );
}
