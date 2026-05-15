import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hunch",
    short_name: "Hunch",
    description:
      "Crypto bets sorted by signal — distance to trigger and Resolution Confidence at a glance.",
    start_url: "/",
    display: "standalone",
    background_color: "#07080b",
    theme_color: "#a78bfa",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
