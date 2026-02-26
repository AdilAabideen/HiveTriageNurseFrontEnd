import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadNurseDashboard } from '../lib/nurseDashboard';
import { EncounterData } from '../types/encounter';
import { NurseDashboardResponse } from '../types/nurse';

type NurseDashboardMap = Record<string, NurseDashboardResponse | null>;

export const useNurseBoardData = () => {
  const [encounters, setEncounters] = useState<EncounterData[]>([]);
  const [dashboardsByEncounterId, setDashboardsByEncounterId] = useState<NurseDashboardMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchBoardData = async () => {
      try {
        setLoading(true);

        const { data: encountersData, error: encountersError } = await supabase
          .from('encounters')
          .select(`
            encounter_id,
            encounter_token,
            current_stage,
            status,
            created_at,
            patient_identity_id
          `)
          .order('created_at', { ascending: false });

        if (encountersError) throw encountersError;

        if (!encountersData || encountersData.length === 0) {
          if (!cancelled) {
            setEncounters([]);
            setDashboardsByEncounterId({});
            setError(null);
          }
          return;
        }

        const patientIds = encountersData
          .map((e) => e.patient_identity_id)
          .filter((id): id is string => Boolean(id));

        let patientIdentities: Record<string, any> = {};
        if (patientIds.length > 0) {
          const { data: patientsData, error: patientsError } = await supabase
            .from('patient_identity')
            .select('*')
            .in('patient_identity_id', patientIds);

          if (patientsError) throw patientsError;

          if (patientsData) {
            patientIdentities = patientsData.reduce((acc, patient) => {
              acc[patient.patient_identity_id] = patient;
              return acc;
            }, {} as Record<string, any>);
          }
        }

        const encounterIds = encountersData.map((e) => e.encounter_id);

        let safetyAnswers: Record<string, any[]> = {};
        if (encounterIds.length > 0) {
          const { data: safetyData, error: safetyError } = await supabase
            .from('encounter_safety_answers')
            .select('*')
            .in('encounter_id', encounterIds);

          if (safetyError) throw safetyError;

          if (safetyData) {
            safetyAnswers = safetyData.reduce((acc, answer) => {
              if (!acc[answer.encounter_id]) acc[answer.encounter_id] = [];
              acc[answer.encounter_id].push(answer);
              return acc;
            }, {} as Record<string, any[]>);
          }
        }

        let chiefComplaints: Record<string, any> = {};
        if (encounterIds.length > 0) {
          const [{ data: ccData, error: ccError }, { data: ccCategories, error: ccCategoriesError }, { data: ccPresentations, error: ccPresentationsError }] =
            await Promise.all([
              supabase.from('encounter_chief_complaint').select('*').in('encounter_id', encounterIds),
              supabase.from('encounter_chief_complaint_category_selections').select('*').in('encounter_id', encounterIds),
              supabase.from('encounter_chief_complaint_presentations').select('*').in('encounter_id', encounterIds),
            ]);

          if (ccError) throw ccError;
          if (ccCategoriesError) throw ccCategoriesError;
          if (ccPresentationsError) throw ccPresentationsError;

          if (ccData) {
            chiefComplaints = ccData.reduce((acc, cc) => {
              acc[cc.encounter_id] = {
                id: cc.id,
                encounter_id: cc.encounter_id,
                overall_text: cc.overall_text,
                created_at: cc.created_at,
                updated_at: cc.updated_at,
                category_selections: (ccCategories || []).filter((c) => c.encounter_id === cc.encounter_id),
                presentations: (ccPresentations || []).filter((p) => p.encounter_id === cc.encounter_id),
              };
              return acc;
            }, {} as Record<string, any>);
          }
        }

        const combinedData: EncounterData[] = encountersData.map((encounter) => ({
          encounter_id: encounter.encounter_id,
          encounter_token: encounter.encounter_token,
          current_stage: encounter.current_stage as EncounterData['current_stage'],
          status: encounter.status as EncounterData['status'],
          created_at: encounter.created_at,
          patient_identity: encounter.patient_identity_id ? patientIdentities[encounter.patient_identity_id] || null : null,
          safety_answers: safetyAnswers[encounter.encounter_id] || [],
          chief_complaint: chiefComplaints[encounter.encounter_id] || null,
        }));

        const dashboardResults = await Promise.allSettled(
          combinedData.map(async (encounter) => {
            const dashboard = await loadNurseDashboard(encounter.encounter_id);
            return [encounter.encounter_id, dashboard] as const;
          }),
        );

        const dashboards: NurseDashboardMap = {};
        dashboardResults.forEach((result, index) => {
          const encounterId = combinedData[index].encounter_id;
          if (result.status === 'fulfilled') {
            dashboards[result.value[0]] = result.value[1];
          } else {
            dashboards[encounterId] = null;
          }
        });

        if (!cancelled) {
          setEncounters(combinedData);
          setDashboardsByEncounterId(dashboards);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBoardData();

    return () => {
      cancelled = true;
    };
  }, []);

  return { encounters, dashboardsByEncounterId, loading, error };
};

