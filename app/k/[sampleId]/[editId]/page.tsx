import { notFound } from "next/navigation";
import { getEdit } from "@/actions/getEdit";
import { getSample } from "@/actions/getSample";
import { SymbolTrack } from "@/components/SymbolTrack";
import type { Cue } from "@/types/symbol";

export default async function KaraokePage({
  params,
}: {
  params: Promise<{ sampleId: string; editId: string }>;
}) {
  const { sampleId, editId } = await params;

  const sample = await getSample({ idOrName: sampleId });
  if (!sample) {
    notFound();
  }

  const edit = await getEdit({ name: editId, sampleId: sample.id });
  if (!edit) {
    notFound();
  }

  return (
    <div className="flex flex-col items-stretch justify-start w-full min-h-dvh">
      <SymbolTrack audioSrc={sample.src} symbols={edit.symbols as Cue[]} />
    </div>
  );
}
