export type NurseFlag = 'GREEN' | 'ORANGE' | 'RED' | string;
export type NurseWorkflowPhase =
  | 'normal_questioning'
  | 'follow_up'
  | 'tier_summary'
  | 'completed'
  | string;
export type NurseQuestionKind = 'normal' | 'follow_up' | 'none' | string;
export type NurseQuestionStatus = 'generated' | 'validated' | string;

export interface NursePatientPresentation {
  presentation_id: string;
  offset?: string | null;
  trend?: string | null;
}

export interface NursePatientInfoSnapshot {
  age_group?: string;
  gender?: string;
  complain_presentation?: NursePatientPresentation[];
  compaint_text?: string;
  discriminators?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface NurseLiveState {
  id?: string;
  encounter_id: string;
  thread_id: string | null;
  patient_info_snapshot: NursePatientInfoSnapshot | null;
  status: string | null;
  workflow_phase: NurseWorkflowPhase | null;
  current_flag: NurseFlag | null;
  current_tier: number | null;
  suggested_tier: number | null;
  active_question_event_id: string | null;
  active_question_kind: NurseQuestionKind | null;
  in_follow_up: boolean | null;
  current_follow_up_discriminator_id: string | null;
  violated_discriminator_ids: string[] | null;
  latest_tier_summary_id: string | null;
  latest_final_summary_id: string | null;
  updated_at: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface NurseQuestionEvent {
  id: string;
  encounter_id: string;
  thread_id: string | null;
  question_sequence: number;
  question_kind: NurseQuestionKind | null;
  tier: number | null;
  workflow_phase_at_insert: string | null;
  in_follow_up: boolean | null;
  parent_question_event_id: string | null;
  parent_discriminator_id: string | null;
  covered_discriminator_ids: string[] | null;
  question_payload: Record<string, unknown> | null;
  question_text: string | null;
  question_type: string | null;
  question_status: NurseQuestionStatus | null;
  user_answer_payload?: unknown;
  normalized_answer_text?: string | null;
  validation_result_payload?: Record<string, unknown> | null;
  follow_up_outcome_payload?: Record<string, unknown> | null;
  resulting_flag?: NurseFlag | null;
  violated_discriminator_ids?: string[] | null;
  notes_for_nurse?: string | null;
  asked_at?: string | null;
  answered_at?: string | null;
  validated_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface NurseTierSummary {
  id: string;
  encounter_id: string;
  thread_id: string | null;
  tier: number;
  summary_schema_version: string;
  summary_payload: Record<string, unknown> | null;
  render_text: string;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface NurseFinalSummary {
  id: string;
  encounter_id: string;
  thread_id: string | null;
  summary_schema_version: string;
  suggested_tier: number | null;
  violated_discriminator_ids: string[];
  summary_payload: Record<string, unknown> | null;
  render_text: string;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface NurseDashboardResponse {
  encounter_id: string;
  live_state: NurseLiveState | null;
  question_events: NurseQuestionEvent[];
  tier_summaries: NurseTierSummary[];
  final_summary: NurseFinalSummary | null;
  stream_url: string;
}

export interface NurseStreamEnvelope {
  event_type: string;
  event_id: string;
  encounter_id: string;
  thread_id: string | null;
  timestamp: string;
  payload: Record<string, unknown>;
}

