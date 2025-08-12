import { Metadata } from "next";
import { cookies } from "next/headers";
import { GetPerspectives } from "@/components/GetPerspectives";
import { getPerspectives } from "@/actions/getPerspectives";
import { getQRCode } from "@/actions/getQRCode";
import { isLocked } from "@/actions/isLocked";
import { getTopic } from "@/actions/getTopic";
import { WritePerspective } from "@/components/WritePerspective";
import { Token } from "@/components/Token";

export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug}`,
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const topic = await getTopic({ name: slug[0] });
  const id = topic?.id;
  const name = topic?.name;
  const token = cookieStore.get(`t_${name}`)?.value;
  const link = await getQRCode({
    text: `${process.env.NEXT_PUBLIC_URL}/t/${slug}`,
  });
  let content = <div className="text-center text-2xl">🔒</div>;
  if (id) {
    const locked = await isLocked({ id });
    const forward = false;
    const perspectives =
      (await getPerspectives({ topicId: id, isLocked: locked, token })) || [];

    if (!token && slug[1] === "w") {
      content = <Token name={name} topicId={id} perspectiveId={null} />;
    } else if (token && slug[1] === "w") {
      content = (
        <WritePerspective
          id={id}
          name={slug[0]}
          perspectives={perspectives}
          locked={locked}
          token={token}
          forward={forward}
          link={link}
        />
      );
    } else if (!locked && slug[0]) {
      content = (
        <>
          <div dangerouslySetInnerHTML={{ __html: link }} />
          <GetPerspectives topicId={id} />
        </>
      );
    }
  }

  return (
    <main className="flex flex-col items-center h-full">
      <div
        className={`flex flex-col ${token ? "w-full justify-between" : "justify-center"} h-full`}
      >
        {content}
      </div>
    </main>
  );
}
