export interface SafetyAnswer {
  id: string;
  question_id: string;
  response: 'yes' | 'no' | 'not_sure';
  severity_if_positive: string | null;
  treat_not_sure_as_positive: boolean | null;
}

export interface PatientIdentity {
  patient_identity_id: string;
  full_name: string;
  date_of_birth: string;
  identity_source: 'patient_reported' | 'staff_entered';
  verified: boolean;
}

export interface ChiefComplaintPresentation {
  id: string;
  category_id: string;
  presentation_id: string;
  offset: string | null;
  trend: string | null;
}

export interface ChiefComplaintCategory {
  id: string;
  category_id: string;
  category_name: string | null;
}

export interface ChiefComplaintData {
  id: string;
  encounter_id: string;
  overall_text: string | null;
  created_at: string;
  updated_at: string;
  category_selections: ChiefComplaintCategory[];
  presentations: ChiefComplaintPresentation[];
}

export interface Discriminator {
  discriminator_id: string;
  label: string;
  definition: string;
  confidence: number;
  tier: string;
  tier_min: number;
  rationale: string | null;
  primary_source: string | null;
}

export interface PresentationWithDiscriminators {
  presentation_id: string;
  presentation_label: string;
  category_id: string;
  offset: string | null;
  trend: string | null;
  discriminators: Discriminator[];
}

export interface EncounterData {
  encounter_id: string;
  encounter_token: string;
  current_stage: 'safety_screen' | 'intake' | 'chief_complaint' | 'chief_complaint_complete' | 'nurse_review' | 'completed' | 'handoff_triage';
  status: 'active' | 'paused_for_review' | 'escalated' | 'completed' | 'closed';
  created_at: string;
  patient_identity: PatientIdentity | null;
  safety_answers: SafetyAnswer[];
  chief_complaint: ChiefComplaintData | null;
}

