import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getPerspectives } from "@/actions/getPerspectives";
import { getQRCode } from "@/actions/getQRCode";
import { getTopic } from "@/actions/getTopic";
import { isLocked } from "@/actions/isLocked";
import { GetPerspectives } from "@/components/GetPerspectives";
import { Token } from "@/components/Token";
import { WritePerspective } from "@/components/WritePerspective";

export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug}`,
  };
}

export default async function Page({ params }) {
  const { slug = [] } = params;
  const [topicName = "", action = "", direction = ""] = slug;
  const cookieStore = await cookies();
  const topic = await getTopic({ name: topicName });
  const id = topic?.id;
  const name = topic?.name;
  const token = name ? cookieStore.get(`t_${name}`)?.value : undefined;
  const link = await getQRCode({
    path: `/t/${slug.join("/")}`,
  });
  let content = <div className="text-center text-2xl">🔒</div>;
  if (id) {
    const locked = await isLocked({ id });
    const forward = direction === "f";
    const perspectives =
      (await getPerspectives({
        topicId: id,
        isLocked: locked,
        token,
        forward,
      })) || [];

    if (!token && action === "w") {
      content = <Token name={name} topicId={id} perspectiveId={null} />;
    } else if (token && action === "w") {
      content = (
        <WritePerspective
          id={id}
          name={topicName}
          perspectives={perspectives}
          locked={locked}
          token={token}
          forward={forward}
          link={link}
        />
      );
    } else if (!locked && topicName) {
      content = (
        <>
          <div className="relative mx-auto">
            <img src={link} alt="QR code" />
          </div>
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
