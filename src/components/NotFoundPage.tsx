import { Link } from "@tanstack/react-router";

export const NotFoundPage = () => {
  return (
    <main className="h-screen flex items-center justify-center">
      <p>
        <Link to="/" className="text-9xl">
          😱
        </Link>
      </p>
    </main>
  );
};
