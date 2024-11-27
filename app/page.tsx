export default function Page() {
  const publicUrl = process.env.NEXT_PUBLIC_URL || "";

  return (
    <main className="flex flex-col items-center h-full">
      <div className="flex flex-col items-center md:w-3/4 m-2">
        <div className="text-[8rem] font-smoothing-none">👾</div>
        <p className="font-smoothing-none">
          I wonder when we are ever gonna{"  "}
          <a
            href={`${publicUrl}/k/nohero/here?start=02%3A19.07&end=02%3A47.99`}
            className="subpixel-antialiased underline text-white font-bold"
          >
            change change.
          </a>
          {"  "}Now I&apos;m awake, and{" "}
          <a
            href={`${publicUrl}/k/sleep/cant?start=01%3A55.55&end=02%3A11.90`}
            className="subpixel-antialiased underline text-white font-bold"
          >
            I can&apos;t go to sleep, I can&apos;t shut my eyes.{" "}
          </a>{" "}
          woke. I wanna tell you how I feel right now. I understand that{" "}
          <a
            href={`${publicUrl}/k/umisays/lifeis?start=0%3A11.779&end=0%3A41.00`}
            className="subpixel-antialiased underline text-white font-bold"
          >
            tomorrow may never come. For you or me, for you and me, our lives
            are not promised.
          </a>{" "}
          You know,
          <a
            href={`${publicUrl}/k/getthere/iknow?start=1%3A08.56&end=1%3A21%3A15`}
            className="subpixel-antialiased underline text-white font-bold"
          >
            {" "}
            i know, i know.
          </a>
        </p>
        <p>
          <a
            href={`${publicUrl}/k/worldwasonfire/saveme?start=0%3A18.399&end=0%3A26.800`}
            className="subpixel-antialiased underline text-white font-bold"
          >
            The world is on fire. Nobody could save us, but you.
          </a>{" "}
          <a
            href={`${publicUrl}/k/takeabow/am?part=ab&start=3%3A36.375&end=4%3A15.000`}
            className="subpixel-antialiased underline text-white font-bold"
          >
            All the world is a stage, and everyone has their part.
          </a>{" "}
          <a
            href={`${publicUrl}/k/freeus/pls?part=_pls&part=pls_`}
            className="subpixel-antialiased underline text-white font-bold text-xs"
          >
            1 part. Free yourself, research yourself, free them. Help to free
            me. Free us.
          </a>{" "}
          there&apos;s beauty in{" "}
          <a
            href={`${publicUrl}/k/ai/letgo?start=2%3A57.09&end=4%3A05.00`}
            className="subpixel-antialiased underline text-white"
          >
            {" "}
            just letting go (2 part)
          </a>
          <a
            href={`${publicUrl}/k/ai/video?start=3%3A01.09&end=3%3A10.00&part=eletgo`}
            className="subpixel-antialiased underline text-white"
          >
            {" "}
            just letting go (2 part remixed)
          </a>{" "}
          Question what else
          <a
            href={`${publicUrl}/k/nothing/else?start=0%3A00.06&end=0%3A26.90`}
            className="subpixel-antialiased text-white"
          >
            {" "}
            matters, repeatedly.
          </a>
        </p>
      </div>
    </main>
  );
}
