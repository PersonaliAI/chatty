export type WhatsAppProvider = "official" | "waha";

export type WahaSessionState = "STOPPED" | "STARTING" | "SCAN_QR_CODE" | "WORKING" | "FAILED";

export interface WahaAntiBanStats {
  sim_age_days: number;
  stage_label: string;
  daily_cap: number | null;
  current_daily_sent: number;
  remaining_today: number | null;
  auto_warmup_enabled: boolean;
}

export interface WahaSessionInfo {
  status: WahaSessionState;
  session_name: string;
  phone_number?: string | null;
  qr_code_data_url?: string | null;
  details?: Record<string, unknown>;
}

export interface WahaStatusResponse {
  ok: boolean;
  session: WahaSessionInfo;
  anti_ban: {
    warmup: WahaAntiBanStats;
    pacing_enabled: boolean;
    spinning_window: number;
    opt_out_shield: boolean;
  };
  provider: WhatsAppProvider;
}

export interface WahaConfigForm {
  endpoint: string;
  apiKey: string;
  sessionName: string;
  simAgeDays: number;
  typingPresenceEnabled: boolean;
  optOutShieldEnabled: boolean;
  dailyCap: number;
  windowStartHour: number;
  windowEndHour: number;
}
