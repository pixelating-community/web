import { getQRCode } from "@/actions/getQRCode";
import { getLyrics } from "@/actions/getLyrics";
import { parseTimestampToSeconds } from "@/lib/parseTimestampToSeconds";
import { KaraokeLyrics } from "@/components/KaraokeLyrics";
import cult from "@/public/w/cult.json";

export async function generateMetadata({ params }) {
  const { slug, id } = await params;
  return {
    title: `k_${slug}_${id}/s`,
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
    text: `${process.env.NEXT_PUBLIC_URL}/k/${slug}/${id}/s${
      queryString ? "?" + queryString : ""
    }`,
  });
  const editableLyrics = (await getLyrics({ trackId: slug, editId: id })) || [];

  const partTimeLyrics_0 =
    part && Array.isArray(part) && part[0]
      ? (await getLyrics({ trackId: slug, editId: part[0] })) || []
      : [];
  const partTimeLyrics_1 =
    part && Array.isArray(part) && part[1]
      ? (await getLyrics({ trackId: slug, editId: part[1] })) || []
      : [];
  const lyrics = [editableLyrics, partTimeLyrics_0, partTimeLyrics_1];

  return (
    <main className="flex flex-col items-center h-full">
      <div dangerouslySetInnerHTML={{ __html: link }} />
      <div className="flex flex-col justify-between w-full h-full overflow-hidden relative">
        {slug === "hurt" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/do-you-really-want-to-hurt-me.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "ver" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/ver.mp3"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "readmind" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/readmind.mp3"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "getthere" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/getthere.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "purple" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/purple.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "bestpart" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/bestpart.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "dirtycomputer" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/dirtycomputer.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "nohero" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/nohero.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "sleep" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/sleep.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "umisays" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/umisays.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "aaj" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/aaj.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "worldwasonfire" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/worldwasonfire.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "takeabow" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/takeabow.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "allheroes" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/allheroes.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "cult" && (
          <KaraokeLyrics
            words={cult}
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/cult.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
      </div>
    </main>
  );
}
