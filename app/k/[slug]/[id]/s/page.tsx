import { KaraokeLyrics } from "@/components/KaraokeLyrics";
import cult from "@/public/w/cult.json";
import freeurself from "@/public/w/freeurself.json";
import ai from "@/public/w/ai.json";
import resist from "@/public/w/resist.json";
import { getKaraokeData } from "@/lib/getKaraokeData";

export async function generateMetadata({ params }) {
  const { slug, id } = await params;
  return {
    title: `k_${slug}_${id}/s`,
  };
}

export default async function Page({ params, searchParams }) {
  const { slug, id, link, lyrics, startTime, endTime } = await getKaraokeData({
    params,
    searchParams,
  });

  return (
    <main className="flex flex-col items-center h-full relative">
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
        {slug === "freeus" && (
          <KaraokeLyrics
            words={freeurself}
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/freeurself.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "ai" && (
          <KaraokeLyrics
            words={ai}
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/ai.m4a"
            s
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
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
        {slug === "resist" && (
          <KaraokeLyrics
            words={resist}
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/resist.m4a"
            s
            startTime={startTime}
            endTime={endTime}
          ></KaraokeLyrics>
        )}
      </div>
    </main>
  );
}
