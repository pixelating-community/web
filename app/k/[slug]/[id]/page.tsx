import { getQRCode } from "@/actions/getQRCode";
import { getLyrics } from "@/actions/getLyrics";
import { KaraokeLyrics } from "@/components/KaraokeLyrics";
import { parseTimestampToSeconds } from "@/lib/parseTimestampToSeconds";

export async function generateMetadata({ params }) {
  const { slug, id } = await params;
  return {
    title: `k_${slug}_${id}`,
  };
}

export default async function Page({ params, searchParams }) {
  const { slug, id } = await params;
  const { start, end } = await searchParams;
  const res = await fetch(
    "https://pixelating.nyc3.cdn.digitaloceanspaces.com/ii.json"
  );
  const ii = await res.json();
  const startTime = parseTimestampToSeconds(decodeURIComponent(start));
  const endTime = parseTimestampToSeconds(decodeURIComponent(end));
  const urlParams = {
    ...(startTime && { start }),
    ...(endTime && { end }),
  };
  const queryString = new URLSearchParams(urlParams).toString();
  const link = await getQRCode({
    text: `${process.env.NEXT_PUBLIC_URL}/k/${slug}/${id}${queryString ? "?" + queryString : ""}`,
  });
  const lyrics = (await getLyrics({ trackId: slug, editId: id })) || [];

  return (
    <main className="flex flex-col items-center h-full">
      <div dangerouslySetInnerHTML={{ __html: link }} />
      <div className="flex flex-col justify-center w-full h-full overflow-hidden relative">
        {slug === "hurt" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/do-you-really-want-to-hurt-me.m4a"
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
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "dirtycomputer" && id !== "ii" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/dirtycomputer.m4a"
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "dirtycomputer" && id === "ii" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={ii}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/dirtycomputer.m4a"
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
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
      </div>
    </main>
  );
}
