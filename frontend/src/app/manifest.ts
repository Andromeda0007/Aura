import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aura — Teaching Assistant",
    short_name: "Aura",
    description: "Real-time teaching assistant for the classroom.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b0f1a",
    theme_color: "#0b0f1a",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
