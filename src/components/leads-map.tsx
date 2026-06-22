"use client";

import { useEffect, useRef } from "react";
import { COUNTRY_CENTROIDS, COUNTRIES, resolveCountryCode } from "@/lib/locale-data";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.L) return resolve(w.L);
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    let s = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null;
    if (s) {
      s.addEventListener("load", () => resolve((window as any).L));
      s.addEventListener("error", reject);
      return;
    }
    s = document.createElement("script");
    s.src = LEAFLET_JS;
    s.async = true;
    s.onload = () => resolve((window as any).L);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

interface Lead {
  country?: string;
  custom_fields?: Record<string, any>;
  [key: string]: any;
}

export function LeadsMap({ leads, color = "#f97316" }: { leads: Lead[]; color?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  const getCountry = (l: Lead): string => l.country || l.custom_fields?.country || "";

  // Aggregate leads by resolved country code
  const byCountry: Record<string, { count: number; names: string[] }> = {};
  for (const l of leads) {
    const code = resolveCountryCode(getCountry(l));
    if (!code || !COUNTRY_CENTROIDS[code]) continue;
    if (!byCountry[code]) byCountry[code] = { count: 0, names: [] };
    byCountry[code].count += 1;
    if (l.name && l.name !== "Anonymous") byCountry[code].names.push(l.name);
  }
  const located = Object.values(byCountry).reduce((a, c) => a + c.count, 0);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          center: [20, 0], zoom: 2, scrollWheelZoom: true, worldCopyJump: true,
        });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; OpenStreetMap &copy; CARTO", maxZoom: 18,
        }).addTo(mapRef.current);
      }
      if (layerRef.current) layerRef.current.remove();
      layerRef.current = L.layerGroup().addTo(mapRef.current);

      const counts = Object.values(byCountry).map((c) => c.count);
      const maxCount = Math.max(1, ...counts);
      for (const [code, info] of Object.entries(byCountry)) {
        const [lat, lng] = COUNTRY_CENTROIDS[code];
        const radius = 8 + (info.count / maxCount) * 22;
        const name = COUNTRIES.find((c) => c.code === code)?.name || code;
        const marker = L.circleMarker([lat, lng], {
          radius, color, fillColor: color, fillOpacity: 0.55, weight: 2,
        }).addTo(layerRef.current);
        const sample = info.names.slice(0, 5).join(", ");
        marker.bindPopup(
          `<strong>${name}</strong><br/>${info.count} lead${info.count > 1 ? "s" : ""}` +
          (sample ? `<br/><span style="color:#888;font-size:11px">${sample}${info.names.length > 5 ? "…" : ""}</span>` : "")
        );
        marker.bindTooltip(`${name}: ${info.count}`, { direction: "top" });
      }
      setTimeout(() => mapRef.current?.invalidateSize(), 100);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, color]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-[11px] text-neutral-500">
        <span><b className="text-neutral-800 dark:text-neutral-200">{located}</b> of {leads.length} leads mapped</span>
        <span><b className="text-neutral-800 dark:text-neutral-200">{Object.keys(byCountry).length}</b> countries</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: color, opacity: 0.6 }} /> bubble size = lead count</span>
      </div>
      <div ref={containerRef} className="w-full h-[460px] rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 z-0" />
      {located === 0 && (
        <p className="text-[11px] text-neutral-400 mt-3 text-center">
          No leads have a recognized country yet. Capture a <code>country</code> field in your lead form to populate the map.
        </p>
      )}
    </div>
  );
}
