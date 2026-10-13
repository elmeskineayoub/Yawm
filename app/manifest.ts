import type { MetadataRoute } from "next";

// Web app manifest (served at /manifest.webmanifest; Next adds the <link> automatically).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yawm",
    short_name: "Yawm",
    description: "Personal planning, tasks, habits, and reflection in one place.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
