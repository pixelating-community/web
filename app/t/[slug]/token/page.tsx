import Link from "next/link";
import { WriteToken } from "@/components/WriteToken";

export default function Page({ params }) {
  const { slug } = params;

  return (
    <main className="relative flex flex-col items-center h-full justify-center">
      <div className="flex flex-col items-center md:w-3/4">
        <div className="flex flex-col items-center w-4/5">
          <WriteToken topicId={slug} />
        </div>
        <Link className="text-lg" href={`/t/${slug}/w`}>
          ⇚
        </Link>
      </div>
    </main>
  );
}
