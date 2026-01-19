import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getPerspectives } from "@/actions/getPerspectives";
import { getQRCode } from "@/actions/getQRCode";
import { getTopic } from "@/actions/getTopic";
import { isLocked } from "@/actions/isLocked";
import { EmptyState } from "@/components/EmptyState";
import { PerspectiveReadings } from "@/components/PerspectiveReadings";
import { Perspectives } from "@/components/Perspectives";
import { WritePerspective } from "@/components/WritePerspective";

export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug } = await params;
  const titles = {
    art: "🎨",
    collection: "💰",
  };
  return { title: titles[slug[0]] };
}

export default async function Page({ params }) {
  const { slug = [] } = await params;
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
    const forward = direction === "f" || action === "f";
    const perspectives =
      (await getPerspectives({
        topicId: id,
        isLocked: locked,
        token,
        forward,
      })) || [];

    if (action === "w") {
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
    } else if (action === "r") {
      content = (
        <PerspectiveReadings
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
      content =
        perspectives.length > 0 ? (
          <Perspectives perspectives={perspectives} link={link} />
        ) : (
          <EmptyState />
        );
    }
  }

  return (
    <main className="flex flex-col items-center h-[100dvh]">
      <div className="flex flex-col flex-1">{content}</div>
    </main>
  );
}
