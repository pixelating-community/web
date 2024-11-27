import { getQRCode } from "@/actions/getQRCode";
import { getLyrics } from "@/actions/getLyrics";
import { parseTimestampToSeconds } from "@/lib/parseTimestampToSeconds";
import { Tap } from "@/components/Tap";
import allheroes from "@/public/w/allheroes.json";
import cult from "@/public/w/cult.json";

export async function generateMetadata({ params }) {
  const { slug, id } = await params;
  return {
    title: `k_${slug}_${id}/t`,
  };
}

export default async function Page({ params, searchParams }) {
  const { slug, id } = await params;
  const { start, end, part } = await searchParams;
  const startTime = parseTimestampToSeconds(decodeURIComponent(start));
  const endTime = parseTimestampToSeconds(decodeURIComponent(end));
  const partTime = decodeURIComponent(part);
  const urlParams = {
    ...(startTime && { start }),
    ...(endTime && { end }),
    ...(partTime && { part }),
  };
  const queryString = new URLSearchParams(urlParams).toString();
  const link = await getQRCode({
    text: `${process.env.NEXT_PUBLIC_URL}/k/${slug}/${id}/t${
      queryString ? "?" + queryString : ""
    }`,
  });
  const editableLyrics = (await getLyrics({ trackId: slug, editId: id })) || [];
  const partTimeLyrics_0 =
    (await getLyrics({ trackId: slug, editId: part[0] })) || [];
  const partTimeLyrics_1 =
    (await getLyrics({ trackId: slug, editId: part[1] })) || [];
  const lyrics = [editableLyrics, partTimeLyrics_0, partTimeLyrics_1];

  return (
    <main className="flex flex-col items-center h-full">
      <div dangerouslySetInnerHTML={{ __html: link }} />
      <div className="flex flex-col justify-center w-full h-full overflow-hidden relative">
        {slug === "allheroes" && (
          <Tap
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/allheroes.m4a"
            words={allheroes}
            startTime={startTime}
            endTime={endTime}
          ></Tap>
        )}
        {slug === "cult" && (
          <Tap
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/cult.m4a"
            words={cult}
            startTime={startTime}
            endTime={endTime}
          ></Tap>
        )}
      </div>
    </main>
  );
}
