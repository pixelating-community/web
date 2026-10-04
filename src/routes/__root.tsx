import "@/styles/globals.css";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { NotFoundPage } from "@/components/NotFoundPage";
import { RootErrorPage } from "@/components/RootErrorPage";
import {
  buildLinkPreviewHead,
  SITE_TITLE,
  SITE_DESCRIPTION,
} from "@/lib/linkPreview";
import { loadLinkPreviewOrigin } from "@/lib/linkPreview.functions";

const SITE_VIEWPORT =
  "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no";
const SITE_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%91%BE%3C/text%3E%3C/svg%3E";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  loader: async () => ({ linkPreviewOrigin: await loadLinkPreviewOrigin() }),
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: SITE_VIEWPORT },
      { name: "theme-color", content: "#a855f7" },
      ...buildLinkPreviewHead(
        { title: SITE_TITLE, description: SITE_DESCRIPTION, path: "/" },
        loaderData?.linkPreviewOrigin,
      ).meta,
      {
        name: "robots",
        content: "noindex, nofollow, noarchive",
      },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: SITE_TITLE },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: SITE_ICON },
      { rel: "apple-touch-icon", href: "/192x192.png" },
    ],
  }),
  component: RootComponent,
  errorComponent: RootErrorPage,
  notFoundComponent: NotFoundPage,
});

function RootComponent() {
  const router = useRouter();
  const queryClient = router.options.context.queryClient;

  return (
    <QueryClientProvider client={queryClient}>
      <RootDocument>
        <Outlet />
      </RootDocument>
    </QueryClientProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
