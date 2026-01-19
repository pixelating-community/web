import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-lg space-y-4">
        <h1 className="text-2xl font-semibold">Sample or edit not found</h1>
        <p className="text-sm text-gray-400">
          Check the sample name in the URL and confirm the audio file exists in
          /public and was uploaded to the samples table.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700/40"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
