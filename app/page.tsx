export default function Page() {
  const publicUrl = process.env.NEXT_PUBLIC_URL || "";

  return (
    <main className="flex flex-col items-center h-full justify-center">
      <div className="flex flex-col items-center justify-center md:w-3/4 m-3">
        <div className="text-[12rem] font-smoothing-none">👾</div>
        <p className="font-smoothing-none text-center">
          i wonder when we are ever gonna{"  "}
          <a
            href={`${publicUrl}/k/nohero/here?start=02%3A19.07&end=02%3A47.99`}
            className="subpixel-antialiased underline"
          >
            change change.
          </a>
          {"  "}cause i&apos;m awake, and{" "}
          <a
            href={`${publicUrl}/k/sleep/cant?start=01%3A55.55&end=02%3A11.90`}
            className="subpixel-antialiased underline"
          >
            i can&apos;t go to sleep, i can&apos;t shut my eyes.{" "}
          </a>
          imwoke. I wanna tell you how I feel right now. I understand that{" "}
          <a
            href={`${publicUrl}/k/umisays/lifeis?start=0%3A11.779&end=0%3A41.00`}
            className="subpixel-antialiased underline"
          >
            tomorrow may never come. For you or me, for you and me, our lives
            are not promised.
          </a>{" "}
          You know,
          <a
            href={`${publicUrl}/k/getthere/iknow?start=1%3A08.56&end=1%3A21%3A15`}
            className="subpixel-antialiased underline"
          >
            i know, i know.
          </a>
        </p>
      </div>
    </main>
  );
}
