import type { MetadataRoute } from "next";

// Yawm is a private, authenticated personal app: ask crawlers not to index anything.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
