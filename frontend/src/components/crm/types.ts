export interface Deal {
  id: string;
  bot_id: string;
  pipeline_id: string;
  stage_id: string;
  title: string;
  contact_id?: string | null;
  session_id?: string | null;
  value_cents: number;
  currency: string;
  status: "open" | "won" | "lost" | "abandoned";
  lost_reason?: string | null;
  expected_close_date?: string | null;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  stage_order: number;
  win_probability: number;
  color: string;
  deals: Deal[];
  deal_count: number;
  total_value_cents: number;
}

export interface KanbanBoardData {
  pipeline: {
    id: string;
    name: string;
    is_default: boolean;
  };
  stages: PipelineStage[];
  total_deals: number;
  total_pipeline_value_cents: number;
}

export interface CognitiveCheckpoint {
  id?: string;
  session_id: string;
  summary_delta?: string;
  rolling_summary?: string;
  active_commitments: string[];
  unresolved_objections: string[];
  next_action?: string;
  customer_sentiment?: "positive" | "neutral" | "hesitant" | "frustrated";
  lead_intent?: "inquiry" | "support" | "sales" | "ready_to_buy" | "complaint";
  turn_number: number;
  updated_at: string;
}
