import { notFound } from "next/navigation";
import { addEdit } from "@/actions/addEdit";
import { editEdit } from "@/actions/editEdit";
import { getEdit } from "@/actions/getEdit";
import { getSample } from "@/actions/getSample";
import { SymbolTrack } from "@/components/SymbolTrack";
import type { Cue } from "@/types/symbol";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ sampleId: string; editId: string }>;
}) {
  const { sampleId, editId } = await params;

  const sample = await getSample({ idOrName: sampleId });
  if (!sample) {
    notFound();
  }

  let edit = await getEdit({ name: editId, sampleId: sample.id });
  if (!edit) {
    edit = await addEdit({ name: editId, sampleId: sample.id });
  }
  if (!edit) {
    notFound();
  }

  return (
    <div className="flex flex-col items-center w-4/5 mx-auto my-0 h-dvh">
      <div className="flex grow-0">
        <div className="fixed w-full -translate-x-2/4 -translate-y-2/4 top-1/2 left-1/2">
          <SymbolTrack
            studio
            audioSrc={sample.src}
            symbols={edit.symbols as Cue[]}
            onSaveSymbols={async (symbols) => {
              "use server";
              await editEdit({ id: edit.id, symbols });
            }}
          />
        </div>
      </div>
    </div>
  );
}
