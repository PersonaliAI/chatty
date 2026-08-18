import { MetadataRoute } from "next";

const BASE = "https://chatty.personaliai.com";

const pages = [
  { url: "/",        priority: 1.0, changeFrequency: "weekly" as const },
  { url: "/support", priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/zoom",    priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
  { url: "/terms",   priority: 0.3, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map(({ url, priority, changeFrequency }) => ({
    url: BASE + url,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
