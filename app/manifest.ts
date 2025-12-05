import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "👾",
    short_name: "👾",
    description: "👾",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    background_color: "#a855f7",
    theme_color: "#a855f7",
    icons: [
      {
        src: "/192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
