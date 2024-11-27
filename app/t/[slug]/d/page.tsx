import { DeleteTopic } from "@/components/DeleteTopic";

export default function Page({ params }) {
  const { slug } = params;

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
