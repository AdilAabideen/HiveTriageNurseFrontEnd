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

const JsonBlock: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
  if (value === null || value === undefined) return null;
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <div className="text-sm font-medium text-gray-900 mb-2 font-hind">{label}</div>
      <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words font-mono">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
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
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);

  useEffect(() => {
    if (!isOpen || !encounter) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const bootstrap = async () => {
      try {
        setLoadingDashboard(true);
        setDashboardError(null);
        setStreamConnected(false);

        const initial = await loadNurseDashboard(encounter.encounter_id);
        if (cancelled) return;

        setDashboard({
          ...initial,
          question_events: sortQuestionEvents(initial.question_events || []),
          tier_summaries: sortTierSummaries(initial.tier_summaries || []),
        });

        unsubscribe = subscribeNurseStream(encounter.encounter_id, {
          onConnected: () => setStreamConnected(true),
          onHeartbeat: () => setLastHeartbeatAt(new Date().toISOString()),
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
          onParseError: (error) => {
            setDashboardError(`SSE parse error: ${error.message}`);
          },
        });
      } catch (error) {
        if (!cancelled) {
          setDashboardError(error instanceof Error ? error.message : 'Failed to load nurse dashboard');
          setDashboard(null);
        }
      } finally {
        if (!cancelled) setLoadingDashboard(false);
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
  const currentQuestion = useMemo(() => {
    if (!liveState?.active_question_event_id) return null;
    return sortedQuestionEvents.find((q) => q.id === liveState.active_question_event_id) || null;
  }, [liveState?.active_question_event_id, sortedQuestionEvents]);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity" onClick={onClose} />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[75%] xl:w-[60%] bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out font-hind ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-900 font-hind">Encounter Details</h2>
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

              <div className="border rounded-lg p-4 bg-white space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold text-gray-900 font-hind">Nurse Triage Dashboard</h3>
                  <div className="text-xs text-gray-500 font-hind">
                    {loadingDashboard ? 'Loading...' : streamConnected ? 'Live stream connected' : 'Stream connecting'}
                  </div>
                </div>

                {dashboardError && <div className="text-sm text-red-600 font-hind">{dashboardError}</div>}

                {!dashboard && !loadingDashboard && !dashboardError && (
                  <div className="text-sm text-gray-500 font-hind">
                    No nurse triage dashboard exists for this encounter yet.
                  </div>
                )}

                {liveState && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge label="Flag" value={liveState.current_flag} tone={getFlagTone(liveState.current_flag)} />
                      <Badge label="Phase" value={liveState.workflow_phase} tone="blue" />
                      <Badge label="Status" value={liveState.status} />
                      <Badge label="Current Tier" value={liveState.current_tier} />
                      <Badge label="Suggested Tier" value={liveState.suggested_tier} />
                      <Badge label="Follow-up" value={liveState.in_follow_up ? 'yes' : 'no'} tone="orange" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <JsonBlock label="Patient Info Snapshot" value={liveState.patient_info_snapshot} />
                      <JsonBlock label="Live State (Raw)" value={liveState} />
                    </div>

                    <div className="text-xs text-gray-500 font-hind">
                      Last heartbeat: {lastHeartbeatAt ? new Date(lastHeartbeatAt).toLocaleTimeString() : 'none yet'}
                    </div>
                  </div>
                )}
              </div>

              {currentQuestion && (
                <div className="border rounded-lg p-4 bg-white space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900 font-hind">Current Question</h3>
                  <div className="text-sm text-gray-900 font-hind">{currentQuestion.question_text || '(no question text)'}</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge label="Kind" value={currentQuestion.question_kind} tone="blue" />
                    <Badge label="Type" value={currentQuestion.question_type} />
                    <Badge label="Status" value={currentQuestion.question_status} />
                    <Badge label="Tier" value={currentQuestion.tier} />
                    <Badge label="Result Flag" value={currentQuestion.resulting_flag} tone={getFlagTone(currentQuestion.resulting_flag)} />
                  </div>
                  {currentQuestion.normalized_answer_text && (
                    <div className="text-sm text-gray-700 font-hind">
                      Answer: <span className="font-medium">{currentQuestion.normalized_answer_text}</span>
                    </div>
                  )}
                  <JsonBlock label="Question Payload" value={currentQuestion.question_payload} />
                </div>
              )}

              {sortedQuestionEvents.length > 0 && (
                <div className="border rounded-lg p-4 bg-white space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 font-hind">Question Timeline</h3>
                  <div className="space-y-4">
                    {sortedQuestionEvents.map((event) => (
                      <div key={event.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="text-sm font-medium text-gray-900 font-hind">
                            #{event.question_sequence} {event.question_text || '(no question text)'}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge label="Kind" value={event.question_kind} tone="blue" />
                            <Badge label="Status" value={event.question_status} />
                            <Badge label="Tier" value={event.tier} />
                            <Badge label="Flag" value={event.resulting_flag} tone={getFlagTone(event.resulting_flag)} />
                          </div>
                        </div>

                        {event.normalized_answer_text && (
                          <div className="text-sm text-gray-700 font-hind">
                            Answer: <span className="font-medium">{event.normalized_answer_text}</span>
                          </div>
                        )}

                        <div className="text-xs text-gray-500 font-hind">
                          Parent: {event.parent_question_event_id || 'none'} | Parent discriminator:{' '}
                          {event.parent_discriminator_id || 'none'}
                        </div>

                        {event.notes_for_nurse && (
                          <div className="text-sm text-gray-700 font-hind italic">Notes for nurse: {event.notes_for_nurse}</div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <JsonBlock label="Question Payload" value={event.question_payload} />
                          <JsonBlock label="User Answer Payload" value={event.user_answer_payload} />
                          <JsonBlock label="Validation Result" value={event.validation_result_payload} />
                          <JsonBlock label="Follow-up Outcome" value={event.follow_up_outcome_payload} />
                        </div>

                        <div className="text-xs text-gray-500 font-hind">
                          asked: {event.asked_at || 'n/a'} | answered: {event.answered_at || 'n/a'} | validated:{' '}
                          {event.validated_at || 'n/a'}
                        </div>
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
                      <div key={summary.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge label="Tier" value={summary.tier} tone="blue" />
                          <Badge label="Schema" value={summary.summary_schema_version} />
                        </div>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap font-hind">{summary.render_text}</div>
                        <JsonBlock label="Tier Summary Payload" value={summary.summary_payload} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {dashboard?.final_summary && (
                <div className="border rounded-lg p-4 bg-white space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 font-hind">Final Summary / Handoff</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge label="Suggested Tier" value={dashboard.final_summary.suggested_tier} tone="red" />
                    <Badge label="Schema" value={dashboard.final_summary.summary_schema_version} />
                  </div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap font-hind">{dashboard.final_summary.render_text}</div>
                  <JsonBlock label="Final Summary Payload" value={dashboard.final_summary.summary_payload} />
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

              <JsonBlock label="Dashboard (Raw Response)" value={dashboard} />
              <JsonBlock label="Encounter (Raw)" value={encounter} />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Overlay;

