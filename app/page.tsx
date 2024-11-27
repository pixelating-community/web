import Link from "next/link";

export default function Page() {
  return (
    <main className="flex flex-col items-center h-full justify-center">
      <div className="flex flex-col items-center justify-center md:w-3/4 m-3">
        <div className="text-[12rem]">👾</div>
      </div>
      <div>
        <ol className="list-[square]">
          <li>
            <Link href="/t/small/f" className="text-[2rem]">
              ⬞
            </Link>
          </li>
          <li>
            <Link href="/t/ran/f" className="text-[4rem]">
              𓀟
            </Link>
          </li>
        </ol>
      </div>
    </main>
  );
}
