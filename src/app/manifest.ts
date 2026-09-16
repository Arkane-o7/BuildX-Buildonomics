import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "AgentPass Approvals", short_name: "AgentPass", start_url: "/phone", scope: "/", display: "standalone", background_color: "#f5f6fb", theme_color: "#5651db", icons: [{ src: "/phone-icon.png", sizes: "512x512", type: "image/png", purpose: "any" }] };
}
