import React, { useEffect, useMemo, useState } from 'react';
import { loadNurseDashboard, subscribeNurseStream, upsertById } from '../lib/nurseDashboard';
import { EncounterData, PatientIdentity } from '../types/encounter';
import {
  NurseDashboardResponse,
  NurseFinalSummary,
  NurseLiveState,
  NurseQuestionEvent,
  NurseTierSummary,
} from '../types/nurse';
import ChiefComplaintView from './ChiefComplaintView';

interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
  encounter: EncounterData | null;
}

// TODO 
// Add Heartbeat as " Last Updated " at the Top Just under Encounter Details

type QuestionOption = {
  patient_facing_label?: string;
  internal_label?: string;
  flag?: string;
  trigger?: string[];
  rule_out?: string[];
};

const Badge: React.FC<{ label: string; value?: string | number | boolean | null; tone?: 'gray' | 'green' | 'orange' | 'red' | 'blue' }> = ({
  label,
  value,
  tone = 'gray',
}) => {
  if (value === null || value === undefined || value === '') return null;
  const tones = {
    gray: 'bg-gray-100 text-gray-800 border-gray-300',
    green: 'bg-green-100 text-green-900 border-green-300',
    orange: 'bg-orange-100 text-orange-900 border-orange-300',
    red: 'bg-red-100 text-red-900 border-red-300',
    blue: 'bg-blue-100 text-blue-900 border-blue-300',
  };

  return (
    <span className={`px-2 py-1 rounded-md border text-xs font-medium font-hind ${tones[tone]}`}>
      {label}: {String(value)}
    </span>
  );
};

function getFlagTone(flag?: string | null): 'gray' | 'green' | 'orange' | 'red' {
  if (flag === 'GREEN') return 'green';
  if (flag === 'ORANGE') return 'orange';
  if (flag === 'RED') return 'red';
  return 'gray';
}

function getFlagPanelClasses(flag?: string | null): string {
  if (flag === 'GREEN') return 'bg-green-50 border-green-200';
  if (flag === 'ORANGE') return 'bg-orange-50 border-orange-200';
  if (flag === 'RED') return 'bg-red-50 border-red-200';
  return 'bg-gray-50 border-gray-200';
}

function formatQuestionType(questionType?: string | null): string | null {
  if (!questionType) return null;
  if (questionType === 'multiple_choice') return 'Multiple Choice';
  if (questionType === 'open_ended') return 'Open Ended';
  return questionType;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function getStringField(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' ? value : null;
}

function getStringArrayField(record: Record<string, unknown> | null, key: string): string[] {
  const value = record?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function getQuestionOptions(record: Record<string, unknown> | null): QuestionOption[] {
  const value = record?.options;
  if (!Array.isArray(value)) return [];
  return value
    .map((option) => asRecord(option))
    .filter((option): option is Record<string, unknown> => Boolean(option))
    .map((option) => ({
      patient_facing_label: getStringField(option, 'patient_facing_label') || undefined,
      internal_label: getStringField(option, 'internal_label') || undefined,
      flag: getStringField(option, 'flag') || undefined,
      trigger: getStringArrayField(option, 'trigger'),
      rule_out: getStringArrayField(option, 'rule_out'),
    }));
}

type IdentitySource = PatientIdentity['identity_source'];

const identitySourceLabels: Record<IdentitySource, string> = {
  patient_reported: 'Reported by Patient',
  staff_entered: 'Verified by Clinician',
};

type CurrentStage = EncounterData['current_stage'];

const currentStageLabels: Record<CurrentStage, string> = {
  safety_screen: 'Safety Screening',
  intake: 'Patient Intake',
  chief_complaint: 'Chief Complaint',
  chief_complaint_complete: 'Chief Complaint Complete',
  nurse_review: 'Nurse Review',
  completed: 'Completed',
  handoff_triage: 'AI Triage in Progress',
};

function sortQuestionEvents(events: NurseQuestionEvent[]) {
  return [...events].sort((a, b) => {
    const seqA = a.question_sequence ?? Number.MAX_SAFE_INTEGER;
    const seqB = b.question_sequence ?? Number.MAX_SAFE_INTEGER;
    return seqA - seqB;
  });
}

function sortTierSummaries(items: NurseTierSummary[]) {
  return [...items].sort((a, b) => a.tier - b.tier);
}

const Overlay: React.FC<OverlayProps> = ({ isOpen, onClose, encounter }) => {
  const [dashboard, setDashboard] = useState<NurseDashboardResponse | null>(null);
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen || !encounter) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const bootstrap = async () => {
      try {
        const initial = await loadNurseDashboard(encounter.encounter_id);
        if (cancelled) return;

        setDashboard({
          ...initial,
          question_events: sortQuestionEvents(initial.question_events || []),
          tier_summaries: sortTierSummaries(initial.tier_summaries || []),
        });

        unsubscribe = subscribeNurseStream(encounter.encounter_id, {
          onConnected: () => undefined,
          onHeartbeat: () => undefined,
          onLiveState: (liveState: NurseLiveState) => {
            setDashboard((prev) =>
              prev
                ? { ...prev, live_state: liveState }
                : {
                  encounter_id: encounter.encounter_id,
                  live_state: liveState,
                  question_events: [],
                  tier_summaries: [],
                  final_summary: null,
                  stream_url: `/triage/nurse/stream/${encounter.encounter_id}`,
                },
            );
          },
          onQuestionGenerated: (row: NurseQuestionEvent) => {
            setDashboard((prev) =>
              prev
                ? { ...prev, question_events: sortQuestionEvents(upsertById(prev.question_events, row)) }
                : prev,
            );
          },
          onQuestionValidated: (row: NurseQuestionEvent) => {
            setDashboard((prev) =>
              prev
                ? { ...prev, question_events: sortQuestionEvents(upsertById(prev.question_events, row)) }
                : prev,
            );
          },
          onTierSummary: (row: NurseTierSummary) => {
            setDashboard((prev) =>
              prev
                ? { ...prev, tier_summaries: sortTierSummaries(upsertById(prev.tier_summaries, row)) }
                : prev,
            );
          },
          onFinalSummary: (row: NurseFinalSummary) => {
            setDashboard((prev) => (prev ? { ...prev, final_summary: row } : prev));
          },
          onParseError: () => undefined,
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load nurse dashboard', error);
          setDashboard(null);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen, encounter?.encounter_id]);

  const liveState = dashboard?.live_state ?? null;
  const sortedQuestionEvents = useMemo(
    () => sortQuestionEvents(dashboard?.question_events || []),
    [dashboard?.question_events],
  );

  const toggleQuestionInspect = (questionId: string) => {
    setExpandedQuestionIds((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity" onClick={onClose} />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[75%] xl:w-[60%] bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out font-hind ${isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        <div className="p-6 h-full overflow-y-auto">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-gray-900 font-hind">Encounter Details</h2>
                {liveState && (
                  <div className="flex flex-wrap gap-2">
                    <Badge label="Flag" value={liveState.current_flag} tone={getFlagTone(liveState.current_flag)} />
                    <Badge label="Phase" value={liveState.workflow_phase} tone="blue" />
                    <Badge label="Status" value={liveState.status} />
                    <Badge label="Current Tier" value={liveState.current_tier} />
                    <Badge label="Suggested Tier" value={liveState.suggested_tier} />
                    <Badge label="Follow-up" value={liveState.in_follow_up ? 'yes' : 'no'} tone="orange" />
                  </div>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-hind">
              ×
            </button>
          </div>

          {encounter && (
            <div className="space-y-6">
              <div className="border rounded-lg p-4 bg-white">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 font-hind">Encounter Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 font-hind">Encounter Token</label>
                    <div className="mt-1 text-gray-900 font-hind">{encounter.encounter_token}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 font-hind">Status</label>
                    <div className="mt-1 text-gray-900 font-hind">{encounter.status[0].toUpperCase() + encounter.status.slice(1).toLowerCase()}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 font-hind">Current Stage</label>
                    <div className="mt-1 text-gray-900 font-hind">
                      {currentStageLabels[encounter.current_stage]}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 font-hind">Created At</label>
                    <div className="mt-1 text-gray-900 font-hind">{new Date(encounter.created_at).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {encounter.patient_identity && (
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 font-hind">Patient Identity</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 font-hind">Full Name</label>
                      <div className="mt-1 text-gray-900 font-hind">{encounter.patient_identity.full_name}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 font-hind">Date of Birth</label>
                      <div className="mt-1 text-gray-900 font-hind">
                        {new Date(encounter.patient_identity.date_of_birth).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 font-hind">Identity Source</label>
                      <div className="mt-1 text-gray-900 font-hind">
                        {identitySourceLabels[encounter.patient_identity.identity_source]}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 font-hind">Verified</label>
                      <div className="mt-1 text-gray-900 font-hind">{encounter.patient_identity.verified ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                </div>
              )}


              {sortedQuestionEvents.length > 0 && (
                <div className="border rounded-lg p-4 bg-white space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 font-hind">Questions Asked</h3>
                  <div className="space-y-4">
                    {sortedQuestionEvents.map((event) => (
                      <div
                        key={event.id}
                        className="border border-gray-200 hover:border-gray-500 rounded-lg p-3 space-y-3 hover:scale-[1.01] transition-all duration-300 cursor-pointer"
                        onClick={() => toggleQuestionInspect(event.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleQuestionInspect(event.id);
                          }
                        }}
                      >
                        {(() => {
                          const payload = asRecord(event.question_payload);
                          const nurseContext = getStringField(payload, 'nurse_context');
                          const payloadDiscriminator = getStringField(payload, 'discriminator_id');
                          const coveredDiscriminators = getStringArrayField(payload, 'covered_discriminator_ids');
                          const eventCoveredDiscriminators = Array.isArray(event.covered_discriminator_ids)
                            ? event.covered_discriminator_ids
                            : [];
                          const discriminatorsToShow = [
                            ...(payloadDiscriminator ? [payloadDiscriminator] : []),
                            ...coveredDiscriminators,
                            ...eventCoveredDiscriminators,
                            ...(event.parent_discriminator_id ? [event.parent_discriminator_id] : []),
                          ].filter((value, index, arr) => arr.indexOf(value) === index);
                          const options = getQuestionOptions(payload);
                          const isExpanded = Boolean(expandedQuestionIds[event.id]);

                          const answerText = options.find((option) => option.internal_label === (event.user_answer_payload as Record<string, unknown>)[0])?.patient_facing_label || event.normalized_answer_text;

                          return (
                            <>
                              <div className="flex flex-col items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="text-sm font-medium text-gray-900 font-hind">
                                    <div className="flex items-end gap-1">
                                      <span className="text-xl text-gray-900 font-hind">{event.question_sequence}</span>
                                      <span className="text-md text-gray-600 font-hind mb-[2px]">{event.question_text || '(no question text)'}</span>
                                    </div>
                                  </div>
                                  {discriminatorsToShow.length > 0 && (
                                    <div className="text-xs text-gray-600 font-hind">
                                      Discriminator{discriminatorsToShow.length > 1 ? 's' : ''}:{' '}
                                      <span className="font-medium">{discriminatorsToShow.join(', ')}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2 items-center">
                                  <Badge label="Kind" value={event.question_kind} tone="blue" />
                                  <Badge label="Question Type" value={formatQuestionType(event.question_type)} />
                                  <Badge label="Status" value={event.question_status} />
                                  <Badge label="Tier" value={event.tier} />
                                  <Badge label="Flag" value={event.resulting_flag} tone={getFlagTone(event.resulting_flag)} />
                                </div>
                              </div>

                              <div className="flex flex-wrap items-start gap-2">
                                <div className="flex flex-col items-start ">
                                  <div className="text-lg font-medium text-gray-600 font-hind">Answer</div>
                                  <div className="text-sm text-gray-900 font-hind">
                                    {answerText || 'No validated answer yet'}
                                  </div>

                                </div>

                                <div className="flex flex-col items-start ">
                                  <div className="text-lg font-medium text-gray-600 font-hind">Justification (Nurse Context)</div>
                                  <div className="text-sm text-gray-900 font-hind">
                                    {nurseContext || 'No nurse context provided'}
                                  </div>
                                </div>

                              </div>

                              {isExpanded && (
                                <div className="space-y-2 border-t pt-3">

                                  <div className="flex flex-col items-start justify-start">
                                    <h1 className="text-lg font-medium text-gray-600 font-hind">Validation Result</h1>
                                    <div className="flex flex-row flex-wrap gap-2">
                                      {(() => {
                                        const rawFlag =
                                          (event.validation_result_payload as { flag?: string } | null)?.flag ?? null;
                                        const rawFollowUpFlag =
                                          (event.follow_up_outcome_payload as { final_flag?: string } | null)?.final_flag ?? null;
                                        return (
                                          <Badge
                                            label="Flag"
                                            value={rawFlag ?? rawFollowUpFlag ?? 'unknown'}
                                            tone={getFlagTone(rawFlag ?? rawFollowUpFlag)}
                                          />
                                        );
                                      })()}
                                      {(() => {
                                        const ruledOut =
                                          (event.validation_result_payload as { ruled_out_discriminators?: string[] } | null)
                                            ?.ruled_out_discriminators ?? null;
                                        const ruledOutFollowUp =
                                          (event.follow_up_outcome_payload as { discriminators_ruled_out?: string[] } | null)
                                            ?.discriminators_ruled_out ?? null;
                                        const allRuledOut = [...(ruledOut || []), ...(ruledOutFollowUp || [])];
                                        if (allRuledOut.length === 0) return null;
                                        return (
                                          <Badge
                                            label="Ruled Out Discriminators"
                                            value={allRuledOut.join(' | ')}
                                            tone="green"
                                          />
                                        );
                                      })()}
                                      {(() => {
                                        const triggeredDiscriminators =
                                          (event.validation_result_payload as { triggered_discriminators?: string[] } | null)
                                            ?.triggered_discriminators ?? null;
                                        const triggeredDiscriminatorsFollowUp =
                                          (event.follow_up_outcome_payload as { discriminators_triggered?: string[] } | null)
                                            ?.discriminators_triggered ?? null;
                                        const allTriggered = [...(triggeredDiscriminators || []), ...(triggeredDiscriminatorsFollowUp || [])];
                                        if (allTriggered.length === 0) return null;
                                        return (
                                          <Badge
                                            label="Triggered Discriminators"
                                            value={allTriggered.join(' | ')}
                                            tone="red"
                                          />
                                        );
                                      })()}

                                    </div>

                                  </div>

                                  {options.length > 0 ? (
                                    <div className="space-y-1">
                                      <h1 className="text-lg font-medium text-gray-600 font-hind">Options</h1>

                                      {options.map((option, optionIndex) => (
                                        <div
                                          key={`${event.id}-opt-${optionIndex}`}
                                          className={`border rounded-lg p-3 ${getFlagPanelClasses(option.flag || null)}`}
                                        >
                                          <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="space-y-1">
                                              <div className="text-sm font-medium text-gray-900 font-hind">
                                                {option.patient_facing_label || option.internal_label || `Option ${optionIndex + 1}`}
                                              </div>
                                              {option.internal_label && option.internal_label !== option.patient_facing_label && (
                                                <div className="text-xs text-gray-700 font-hind">
                                                  Internal: {option.internal_label}
                                                </div>
                                              )}
                                            </div>
                                            <Badge label="Flag" value={option.flag || 'unknown'} tone={getFlagTone(option.flag || null)} />
                                          </div>
                                          {(option.trigger?.length || option.rule_out?.length) ? (
                                            <div className="mt-2 text-xs text-gray-700 font-hind space-y-1">
                                              {option.trigger && option.trigger.length > 0 && (
                                                <div>Trigger: {option.trigger.join(', ')}</div>
                                              )}
                                              {option.rule_out && option.rule_out.length > 0 && (
                                                <div>Rule Out: {option.rule_out.join(', ')}</div>
                                              )}
                                            </div>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-500 font-hind">
                                      <h1 className="text-lg font-medium text-gray-600 font-hind">Open Ended Question Rules</h1>
                                      <div className='ml-2'>
                                        {
                                          (event.question_payload as { open_ended_validation_rules?: string[] } | null)?.open_ended_validation_rules?.map((rule, index) => (
                                            <span className='flex flex-row items-start justify-start gap-2'>
                                              <p className='text-sm text-gray-900 font-hind'>{index + 1}.</p>
                                              <p className='text-sm text-gray-600 font-hind' key={index}>{rule}</p>
                                            </span>
                                          ))
                                        }
                                      </div>

                                    </div>
                                  )}



                                </div>
                              )}

                              <div className="text-xs text-gray-500 font-hind">
                                asked: {event.asked_at ? new Date(event.asked_at).toLocaleTimeString() : 'n/a'} | answered: {event.answered_at ? new Date(event.answered_at).toLocaleTimeString() : 'n/a'} | validated:{' '}
                                {event.validated_at ? new Date(event.validated_at).toLocaleTimeString() : 'n/a'}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dashboard?.tier_summaries?.length ? (
                <div className="border rounded-lg p-4 bg-white space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 font-hind">Tier Summaries</h3>
                  <div className="space-y-4">
                    {sortTierSummaries(dashboard.tier_summaries).map((summary) => (
                      <div key={summary.id} className="border border-gray-200 rounded-lg p-3 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge label="Tier" value={summary.tier} tone="blue" />
                        </div>
                        {(() => {
                          const payload = asRecord(summary.summary_payload);
                          const questionsAskedSummary = Array.isArray(payload?.questions_asked_summary)
                            ? payload.questions_asked_summary
                                .map((item) => asRecord(item))
                                .filter((item): item is Record<string, unknown> => Boolean(item))
                            : [];
                          const ruledOutDiscriminators = getStringArrayField(payload, 'ruled_out_discriminators');
                          const triggeredDiscriminators = getStringArrayField(payload, 'triggered_discriminators');
                          const remainingUnknownDiscriminators = getStringArrayField(payload, 'remaining_unknown_discriminators');
                          const remainingPossibilitiesForTier = getStringArrayField(payload, 'remaining_possibilities_for_this_tier');
                          const unaskedDiscriminatorsForNurse = Array.isArray(payload?.unasked_discriminators_for_nurse)
                            ? payload.unasked_discriminators_for_nurse
                                .map((item) => {
                                  if (typeof item === 'string') return item;
                                  const record = asRecord(item);
                                  return getStringField(record, 'discriminator_id') || getStringField(record, 'label') || null;
                                })
                                .filter((item): item is string => Boolean(item))
                            : [];

                          const tierSummaryFields = [
                            { title: 'Summary', value: getStringField(payload, 'render_text') || summary.render_text || null },
                            { title: 'Tier Status', value: getStringField(payload, 'tier_status') },
                            { title: 'Confidence Notes', value: getStringField(payload, 'confidence_notes') },
                            { title: 'Why Tier Was Cleared', value: getStringField(payload, 'why_tier_cleared') },
                            { title: 'Tier Justification', value: getStringField(payload, 'tier_justification') },
                            { title: 'Why Not Asked Summary', value: getStringField(payload, 'why_not_asked_summary') },
                          ].filter((field) => field.value !== null && field.value !== undefined && field.value !== '');

                          return (
                            <div className="space-y-2">
                              {tierSummaryFields.map((field) => (
                                <div key={`${summary.id}-${field.title}`}>
                                  <h1 className="text-lg font-medium text-gray-600 font-hind">{field.title}</h1>
                                  <p className="text-sm text-gray-600 font-hind whitespace-pre-wrap">{String(field.value)}</p>
                                </div>
                              ))}

                              {questionsAskedSummary.length > 0 && (
                                <div>
                                  <h1 className="text-lg font-medium text-gray-600 font-hind">Questions Asked Summary</h1>
                                  <div className="ml-2">
                                    {questionsAskedSummary.map((item, index) => {
                                      const infoGained = getStringField(item, 'info_gained');
                                      const questionText = getStringField(item, 'question_text');
                                      return (
                                        <span
                                          key={`${summary.id}-qas-${index}`}
                                          className="flex flex-row  items-start justify-start gap-2"
                                        >
                                          <p className="text-sm text-gray-900 font-hind">{index + 1}.</p>
                                          <p className="text-sm text-gray-600 font-hind">
                                            {infoGained || 'No info gained provided'}
                                            {questionText ? ` | ${questionText}` : ''}
                                          </p>
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2">
                                {ruledOutDiscriminators.length > 1 && (
                                  <Badge
                                    label="Ruled Out Discriminators"
                                    value={ruledOutDiscriminators.join(' | ')}
                                    tone="green"
                                  />
                                )}
                                {triggeredDiscriminators.length > 0 && (
                                  <Badge
                                    label="Triggered Discriminators"
                                    value={triggeredDiscriminators.join(' | ')}
                                    tone="red"
                                  />
                                )}
                                {remainingUnknownDiscriminators.length > 0 && (
                                  <Badge
                                    label="Remaining Unknown Discriminators"
                                    value={remainingUnknownDiscriminators.join(' | ')}
                                    tone="orange"
                                  />
                                )}
                                {remainingPossibilitiesForTier.length > 0 && (
                                  <Badge
                                    label="Remaining Possibilities For Tier"
                                    value={remainingPossibilitiesForTier.join(' | ')}
                                    tone="orange"
                                  />
                                )}
                                {unaskedDiscriminatorsForNurse.length > 0 && (
                                  <Badge
                                    label="Unasked Discriminators For Nurse"
                                    value={unaskedDiscriminatorsForNurse.join(' | ')}
                                    tone="orange"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {dashboard?.final_summary && (
                <div className="border rounded-lg p-4 bg-white space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 font-hind">Final Summary / Handoff</h3>
                  {(() => {
                    const finalSummary = dashboard.final_summary;
                    const payload = asRecord(finalSummary.summary_payload);
                    const violatedDiscriminatorIds = getStringArrayField(payload, 'violated_discriminator_ids');
                    const immediateReasons = getStringArrayField(payload, 'immediate_nurse_attention_reasons');
                    const handoffChecklist = getStringArrayField(payload, 'handoff_checklist');

                    const questionsToConfirmViolation = Array.isArray(payload?.questions_to_confirm_violation)
                      ? payload.questions_to_confirm_violation
                          .map((item) => asRecord(item))
                          .filter((item): item is Record<string, unknown> => Boolean(item))
                      : [];
                    const questionsToRuleOutAlternatives = Array.isArray(payload?.questions_to_rule_out_alternatives)
                      ? payload.questions_to_rule_out_alternatives
                          .map((item) => asRecord(item))
                          .filter((item): item is Record<string, unknown> => Boolean(item))
                      : [];
                    const evidenceChain = Array.isArray(payload?.evidence_chain)
                      ? payload.evidence_chain
                          .map((item) => asRecord(item))
                          .filter((item): item is Record<string, unknown> => Boolean(item))
                      : [];
                    const violatedDiscriminatorSummary = Array.isArray(payload?.violated_discriminator_summary)
                      ? payload.violated_discriminator_summary
                          .map((item) => asRecord(item))
                          .filter((item): item is Record<string, unknown> => Boolean(item))
                      : [];

                    const finalFields = [
                      { title: 'Summary', value: getStringField(payload, 'render_text') || finalSummary.render_text || null },
                      { title: 'Suggested Tier', value: payload?.suggested_tier ?? finalSummary.suggested_tier ?? null },
                      { title: 'Follow Up Summary', value: getStringField(payload, 'follow_up_summary') },
                      { title: 'Why Suggested Tier', value: getStringField(payload, 'why_suggested_tier') },
                    ].filter((field) => field.value !== null && field.value !== undefined && field.value !== '');

                    const renderQuestionLikeList = (
                      title: string,
                      items: Record<string, unknown>[],
                    ) => {
                      if (items.length === 0) return null;
                      return (
                        <div>
                          <h1 className="text-lg font-medium text-gray-600 font-hind">{title}</h1>
                          <div className="ml-2 space-y-1">
                            {items.map((item, index) => {
                              const questionText =
                                getStringField(item, 'question_text')
                                || getStringField(item, 'question')
                                || getStringField(item, 'text')
                                || getStringField(item, 'label')
                                || JSON.stringify(item);
                              const reason =
                                getStringField(item, 'reason')
                                || getStringField(item, 'rationale')
                                || getStringField(item, 'why')
                                || null;
                              return (
                                <div key={`${title}-${index}`} className="space-y-1">
                                  <span className="flex flex-row flex-wrap items-start justify-start gap-2">
                                    <p className="text-sm text-gray-900 font-hind">{index + 1}.</p>
                                    <p className="text-sm text-gray-600 font-hind">{questionText}</p>
                                  </span>
                                  {reason && <p className="text-sm text-gray-600 font-hind ml-6">{reason}</p>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    };

                    const renderViolatedDiscriminatorSummary = (items: Record<string, unknown>[]) => {
                      if (items.length === 0) return null;
                      return (
                        <div>
                          <h1 className="text-lg font-medium text-gray-600 font-hind">Violated Discriminator Summary</h1>
                          <div className="ml-2 space-y-2">
                            {items.map((item, index) => (
                              <div key={`violated-discriminator-${index}`} className="space-y-1">
                                <span className="flex flex-row flex-wrap items-start justify-start gap-2">
                                  <p className="text-sm text-gray-900 font-hind">{index + 1}.</p>
                                  <p className="text-sm text-gray-600 font-hind">
                                    {getStringField(item, 'label') || getStringField(item, 'discriminator_id') || 'Unknown discriminator'}
                                  </p>
                                </span>
                                {getStringField(item, 'discriminator_id') && (
                                  <p className="text-sm text-gray-600 font-hind ml-6">
                                    ID: {getStringField(item, 'discriminator_id')}
                                  </p>
                                )}
                                {getStringField(item, 'why_violated') && (
                                  <p className="text-sm text-gray-600 font-hind ml-6">
                                    {getStringField(item, 'why_violated')}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    };

                    const renderEvidenceChain = (items: Record<string, unknown>[]) => {
                      if (items.length === 0) return null;
                      return (
                        <div>
                          <h1 className="text-lg font-medium text-gray-600 font-hind">Evidence Chain</h1>
                          <div className="ml-2 space-y-3">
                            {items.map((item, index) => (
                              <div key={`evidence-chain-${index}`} className="space-y-1">
                                <span className="flex flex-row flex-wrap items-start justify-start gap-2">
                                  <p className="text-sm text-gray-900 font-hind">{index + 1}.</p>
                                  <p className="text-sm text-gray-600 font-hind">
                                    {getStringField(item, 'question_text') || 'No question text'}
                                  </p>
                                </span>
                                <div className="ml-6 flex flex-wrap gap-2">
                                  <Badge label="Kind" value={getStringField(item, 'question_kind')} tone="blue" />
                                  <Badge label="Question Event ID" value={getStringField(item, 'question_event_id')} />
                                </div>
                                {getStringField(item, 'patient_answer') && (
                                  <p className="text-sm text-gray-600 font-hind ml-6">
                                    Patient Answer: {getStringField(item, 'patient_answer')}
                                  </p>
                                )}
                                {getStringField(item, 'effect_on_discriminator') && (
                                  <p className="text-sm text-gray-600 font-hind ml-6">
                                    Effect: {getStringField(item, 'effect_on_discriminator')}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge label="Suggested Tier" value={finalSummary.suggested_tier} tone="red" />
                          <Badge label="Schema" value={finalSummary.summary_schema_version} />
                          {violatedDiscriminatorIds.length > 0 && (
                            <Badge
                              label="Violated Discriminators"
                              value={violatedDiscriminatorIds.join(' | ')}
                              tone="red"
                            />
                          )}
                          {immediateReasons.length > 0 && (
                            <Badge
                              label="Immediate Nurse Attention Reasons"
                              value={immediateReasons.join(' | ')}
                              tone="orange"
                            />
                          )}
                          {handoffChecklist.length > 0 && (
                            <Badge
                              label="Handoff Checklist"
                              value={handoffChecklist.join(' | ')}
                              tone="blue"
                            />
                          )}
                        </div>

                        <div className="space-y-2">
                          {finalFields.map((field) => (
                            <div key={`${finalSummary.id}-${field.title}`}>
                              <h1 className="text-lg font-medium text-gray-600 font-hind">{field.title}</h1>
                              <p className="text-sm text-gray-600 font-hind whitespace-pre-wrap">{String(field.value)}</p>
                            </div>
                          ))}
                        </div>

                        {renderViolatedDiscriminatorSummary(violatedDiscriminatorSummary)}
                        {renderEvidenceChain(evidenceChain)}
                        {renderQuestionLikeList('Questions To Confirm Violation', questionsToConfirmViolation)}
                        {renderQuestionLikeList('Questions To Rule Out Alternatives', questionsToRuleOutAlternatives)}
                      </div>
                    );
                  })()}
                </div>
              )}

              {encounter.current_stage === 'chief_complaint_complete' && encounter.chief_complaint && (
                <div className="border rounded-lg p-4 bg-white">
                  <ChiefComplaintView chiefComplaint={encounter.chief_complaint} discriminatorsData={{}} />
                </div>
              )}

              <div className="border rounded-lg p-4 bg-white">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 font-hind">Safety Answers</h3>
                {encounter.safety_answers.length > 0 ? (
                  <div className="space-y-3">
                    {encounter.safety_answers.map((answer) => (
                      <div key={answer.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="text-sm font-medium text-gray-900 font-hind">{answer.question_id}</div>
                        <div className="text-sm text-gray-600 font-hind">Response: {answer.response}</div>
                        {answer.severity_if_positive && (
                          <div className="text-sm text-gray-600 font-hind">Severity: {answer.severity_if_positive}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 font-hind">No safety answers recorded.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Overlay;
