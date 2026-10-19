import { MetadataRoute } from "next";
import { COMPARISONS } from "@/data/comparisons";

const BASE = "https://chatty.personaliai.com";

const staticPages = [
  { url: "/",           priority: 1.0, changeFrequency: "weekly" as const },
  { url: "/compare",    priority: 0.9, changeFrequency: "weekly" as const },
  { url: "/login",      priority: 0.8, changeFrequency: "monthly" as const },
  { url: "/signup",     priority: 0.8, changeFrequency: "monthly" as const },
  { url: "/support",    priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/zoom",       priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/privacy",    priority: 0.3, changeFrequency: "yearly" as const },
  { url: "/terms",      priority: 0.3, changeFrequency: "yearly" as const },
  { url: "/affiliate",  priority: 0.8, changeFrequency: "weekly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const comparisonPages = Object.keys(COMPARISONS).map((slug) => ({
    url: `${BASE}/compare/${slug}`,
    lastModified: new Date(COMPARISONS[slug].updatedAt || new Date()),
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }));

  const baseItems = staticPages.map(({ url, priority, changeFrequency }) => ({
    url: BASE + url,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));

  return [...baseItems, ...comparisonPages];
}
