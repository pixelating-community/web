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
            change change
          </a>
        </p>
      </div>
    </main>
  );
}
