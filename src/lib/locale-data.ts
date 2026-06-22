// Timezone + country data and browser auto-detection helpers.

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

// Curated, commonly-used country list (extend as needed).
export const COUNTRIES: CountryOption[] = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "IL", name: "Israel", flag: "🇮🇱" },
];

// Approx country centroids [lat, lng] for plotting leads on a map.
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  US: [39.8, -98.6], GB: [54, -2], CA: [56, -106], AU: [-25, 133], DE: [51, 10],
  FR: [46, 2], ES: [40, -4], IT: [42, 12], NL: [52, 5], IE: [53, -8], IN: [22, 79],
  LK: [7.8, 80.7], SG: [1.35, 103.8], AE: [24, 54], SA: [24, 45], JP: [36, 138],
  CN: [35, 105], HK: [22.3, 114.2], KR: [36, 128], BR: [-10, -55], MX: [23, -102],
  AR: [-34, -64], ZA: [-29, 24], NG: [9, 8], KE: [0, 38], EG: [27, 30], SE: [62, 15],
  NO: [62, 10], DK: [56, 10], FI: [64, 26], PL: [52, 19], PT: [39.5, -8], CH: [47, 8],
  AT: [47.5, 14], BE: [50.8, 4], NZ: [-42, 174], MY: [4, 102], ID: [-2, 118],
  TH: [15, 101], PH: [13, 122], VN: [16, 108], PK: [30, 70], BD: [24, 90], TR: [39, 35],
  IL: [31, 35],
};

// Resolve a free-text country value (name or code) to an ISO code we can map.
export function resolveCountryCode(value: string): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  const byCode = COUNTRIES.find((c) => c.code.toLowerCase() === v);
  if (byCode) return byCode.code;
  const byName = COUNTRIES.find(
    (c) => c.name.toLowerCase() === v || c.name.toLowerCase().includes(v) || v.includes(c.name.toLowerCase())
  );
  return byName ? byName.code : null;
}

// Minimal IANA timezone -> ISO country map for auto-detection.
const TZ_TO_COUNTRY: Record<string, string> = {
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US",
  "Europe/London": "GB", "Europe/Dublin": "IE", "America/Toronto": "CA",
  "America/Vancouver": "CA", "Australia/Sydney": "AU", "Australia/Melbourne": "AU",
  "Australia/Perth": "AU", "Europe/Berlin": "DE", "Europe/Paris": "FR",
  "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Amsterdam": "NL",
  "Asia/Kolkata": "IN", "Asia/Colombo": "LK", "Asia/Singapore": "SG",
  "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Tokyo": "JP",
  "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK", "Asia/Seoul": "KR",
  "America/Sao_Paulo": "BR", "America/Mexico_City": "MX",
  "America/Argentina/Buenos_Aires": "AR", "Africa/Johannesburg": "ZA",
  "Africa/Lagos": "NG", "Africa/Nairobi": "KE", "Africa/Cairo": "EG",
  "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI", "Europe/Warsaw": "PL", "Europe/Lisbon": "PT",
  "Europe/Zurich": "CH", "Europe/Vienna": "AT", "Europe/Brussels": "BE",
  "Pacific/Auckland": "NZ", "Asia/Kuala_Lumpur": "MY", "Asia/Jakarta": "ID",
  "Asia/Bangkok": "TH", "Asia/Manila": "PH", "Asia/Ho_Chi_Minh": "VN",
  "Asia/Karachi": "PK", "Asia/Dhaka": "BD", "Europe/Istanbul": "TR",
  "Asia/Jerusalem": "IL",
};

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function detectCountryCode(): string {
  const tz = detectTimezone();
  return TZ_TO_COUNTRY[tz] || "US";
}

// Full IANA timezone list (falls back to a curated set on old browsers).
export function getTimezones(): string[] {
  try {
    const supported = (Intl as unknown as {
      supportedValuesOf?: (k: string) => string[];
    }).supportedValuesOf;
    const list = supported?.("timeZone");
    if (list && list.length) return list;
  } catch {
    /* fall through */
  }
  return [
    "UTC", "America/New_York", "America/Chicago", "America/Denver",
    "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin",
    "Asia/Kolkata", "Asia/Colombo", "Asia/Dubai", "Asia/Singapore",
    "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney",
  ];
}

// e.g. "Asia/Colombo" -> "+05:30"
export function tzOffsetLabel(tz: string): string {
  try {
    const now = new Date();
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const part = dtf.formatToParts(now).find((p) => p.type === "timeZoneName");
    return part?.value.replace("GMT", "UTC") || "";
  } catch {
    return "";
  }
}
