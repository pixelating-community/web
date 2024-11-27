import { KaraokeLyrics } from "@/components/KaraokeLyrics";
import { getKaraokeData } from "@/lib/getKaraokeData";

export async function generateMetadata({ params }) {
  const { slug, id } = await params;
  return {
    title: `k_${slug}_${id}`,
  };
}

export default async function Page({ params, searchParams }) {
  const { slug, id, link, lyrics, startTime, endTime } = await getKaraokeData({
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
        {slug === "dirtycomputer" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
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
        {slug === "takeabow" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/takeabow.m4a"
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "cult" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/cult.m4a"
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "freeus" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/freeurself.m4a"
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "ai" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/ai.m4a"
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "nothing" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/nothing.m4a"
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
      </div>
    </main>
  );
}
