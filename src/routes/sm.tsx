import { createFileRoute, Link } from "@tanstack/react-router";
import { SMComposer } from "@/components/SMComposer";

export const Route = createFileRoute("/sm")({
  head: () => ({ meta: [{ title: "sm" }] }),
  component: SMPage,
});

function SMPage() {
  return (
    <main className="min-h-dvh bg-[#18131c] px-4 py-4 text-white sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <nav
          aria-label="Home"
          className="mb-5 flex items-center gap-3 text-xs tracking-[0.16em] text-white/40 uppercase sm:mb-12"
        >
          <Link
            to="/"
            className="unstyled-link inline-flex min-h-11 items-center text-white/75 hover:text-white"
          >
            👾 PXL8
          </Link>
          <span aria-hidden="true">/</span>
          <span>sm</span>
        </nav>
        <SMComposer />
      </div>
    </main>
  );
}
