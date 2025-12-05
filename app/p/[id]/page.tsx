import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Perspectives } from "@/components/Perspectives";
import { ReflectionTree } from "@/components/ReflectionTree";

export const dynamic = "force-static";
export const revalidate = 300;

type PromptResponse = {
  perspective: {
    id: string;
    perspective: string;
    topic_id: string;
    collection_id?: string | null;
  };
  link?: string;
};

const getPrompt = async (id: string): Promise<PromptResponse | null> => {
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (!baseUrl) return null;

  const res = await fetch(`${baseUrl}/api/p/${id}/prompt`, {
    next: { revalidate },
  });
  if (!res.ok) return null;
  return res.json();
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: id ?? "Perspective Page" };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const data = await getPrompt(id);
  if (!data?.perspective) notFound();

  return (
    <div className="flex flex-col w-4/5 my-0 mx-auto h-dvh items-center">
      <div className="flex grow-0">
        <div className="fixed -translate-x-2/4 -translate-y-2/4 top-1/2 left-1/2">
          <Perspectives
            perspectives={[data.perspective]}
            link={data.link ?? ""}
          />
          <div className="flex justify-center w-full p-1">
            <div className="max-h-[60vh] overflow-y-auto w-full">
              <ReflectionTree perspectiveId={id} initialReflections={[]} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
