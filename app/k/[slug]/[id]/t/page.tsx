import { Taps } from "@/components/Taps";
import { getKaraokeData } from "@/lib/getKaraokeData";

export async function generateMetadata({ params }) {
  const { slug, id } = await params;
  return {
    title: `k_${slug}_${id}/t`,
  };
}

export default async function Page({ params, searchParams }) {
  const { slug, link, lyrics, startTime, endTime } = await getKaraokeData({
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
        {slug === "allheroes" && (
          <Taps
            trackId={slug}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/allheroes.m4a"
            startTime={startTime}
            endTime={endTime}
          ></Taps>
        )}
        {slug === "cult" && (
          <Taps
            trackId={slug}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/cult.m4a"
            startTime={startTime}
            endTime={endTime}
          ></Taps>
        )}
        {slug === "freeus" && (
          <Taps
            trackId={slug}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/freeurself.m4a"
            startTime={startTime}
            endTime={endTime}
          ></Taps>
        )}
        {slug === "ai" && (
          <Taps
            trackId={slug}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/ai.m4a"
            startTime={startTime}
            endTime={endTime}
          ></Taps>
        )}
      </div>
    </main>
  );
}
