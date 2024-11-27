import { getQRCode } from "@/actions/getQRCode";
import { getLyrics } from "@/actions/getLyrics";
import { KaraokeLyrics } from "@/components/KaraokeLyrics";

export async function generateMetadata({ params }) {
  const { slug, id } = await params;
  return {
    title: `k_${slug}_${id}`,
  };
}

export default async function Page({ params }) {
  const { slug, id } = await params;
  const lyrics = (await getLyrics({ trackId: slug, editId: id })) || [];
  const link = await getQRCode({
    text: `${process.env.NEXT_PUBLIC_URL}/k/${slug}`,
  });

  return (
    <main className="flex flex-col items-center h-full">
      <div
        dangerouslySetInnerHTML={{ __html: link }}
        aria-label="Generated SVG"
      />
      <div className="flex flex-col justify-center w-full h-full overflow-hidden relative">
        {slug === "hurt" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/do-you-really-want-to-hurt-me.m4a"
          ></KaraokeLyrics>
        )}
        {slug === "ver" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/ver.mp3"
          ></KaraokeLyrics>
        )}
        {slug === "readmind" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/readmind.mp3"
          ></KaraokeLyrics>
        )}
        {slug === "getthere" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/getthere.mp3"
          ></KaraokeLyrics>
        )}
        {slug === "purple" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/purple.m4a"
          ></KaraokeLyrics>
        )}
        {slug === "bestpart" && (
          <KaraokeLyrics
            trackId={slug}
            editId={id}
            lyrics={lyrics}
            audioSrc="https://pixelating.nyc3.cdn.digitaloceanspaces.com/bestpart.m4a"
          ></KaraokeLyrics>
        )}
      </div>
    </main>
  );
}
