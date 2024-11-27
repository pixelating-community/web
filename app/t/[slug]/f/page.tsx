import Image from "next/image";
import { GetPerspectives } from "@/components/GetPerspectives";
import { getQRCode, isLocked } from "@/actions";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return {
    title: `\/t\/${slug}`,
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const locked = await isLocked(slug);
  const link = await getQRCode(`${process.env.NEXT_PUBLIC_URL}/t/${slug}/f`);

  return (
    <main className="flex flex-col items-center h-full">
      <div className="flex flex-col justify-between w-full h-full overflow-hidden relative">
        {!locked ? (
          <>
            <Image
              src={link}
              alt={`url = /t/${slug}`}
              width={100}
              height={100}
            />
            <GetPerspectives topicId={slug} forward={true} />
          </>
        ) : (
          <div className="text-center text-2xl">🔒</div>
        )}
      </div>
    </main>
  );
}
