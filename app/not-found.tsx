import Link from "next/link";

export default function NotFound() {
  return (
    <main className="h-screen flex items-center justify-center">
      <p>
        <Link href="/" className="text-9xl">
          😱
        </Link>
      </p>
    </main>
  );
}
