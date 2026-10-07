import { MetadataRoute } from "next";

const BASE = "https://chatty.personaliai.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/checkout",
        "/success",
        "/embed/",
        "/auth/",
        "/api/",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
