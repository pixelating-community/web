import { KaraokeLyrics } from "@/components/KaraokeLyrics";
import { getKaraokeData } from "@/lib/getKaraokeData";

export async function generateMetadata({ params }) {
  const { slug, id } = await params;
  return {
    title: `k_${slug}_${id}`,
  };
}

export default async function Page({ params, searchParams }) {
  const { trackId, editId, link, lyrics, startTime, endTime } =
    await getKaraokeData({
      params,
      searchParams,
    });
  return (
    <main className="flex flex-col items-center h-full">
      <div className="flex flex-col justify-between w-full h-full overflow-hidden relative">
        <div
          className="flex justify-center"
          dangerouslySetInnerHTML={{ __html: link }}
        />
        <KaraokeLyrics
          trackId={trackId}
          editId={editId}
          lyrics={Array.isArray(lyrics) ? lyrics.filter(Boolean) : []}
          audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/nothing.m4a"
          startTime={startTime}
          endTime={endTime}
        ></KaraokeLyrics>
      </div>
    </main>
  );
}
