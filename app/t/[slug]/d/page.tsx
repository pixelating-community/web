import { DeleteTopic } from "@/components/DeleteTopic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return {
    title: `\/t\/${slug}`,
  };
}

export default async function Page({ params }) {
  const { slug } = await params;

  return (
    <main className="relative flex flex-col items-center h-full justify-center">
      <div className="flex flex-col items-center md:w-3/4">
        <div className="flex flex-col items-center w-4/5">
          <DeleteTopic topicId={slug} />
        </div>
      </div>
    </main>
  );
}
