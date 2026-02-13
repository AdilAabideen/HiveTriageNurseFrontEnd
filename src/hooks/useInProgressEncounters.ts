import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { EncounterData } from '../types/encounter';

export const useInProgressEncounters = () => {
  const [encounters, setEncounters] = useState<EncounterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEncounters = async () => {
      try {
        setLoading(true);
        
        // Fetch encounters with current_stage 'safety_screen' or 'chief_complaint'
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
          .in('current_stage', ['safety_screen', 'chief_complaint', 'chief_complaint_complete']);

        if (encountersError) throw encountersError;

        if (!encountersData) {
          setEncounters([]);
          setLoading(false);
          return;
        }

        // Fetch patient identities for all encounters
        const patientIds = encountersData
          .map(e => e.patient_identity_id)
          .filter((id): id is string => id !== null);

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

        // Fetch safety answers for all encounters
        const encounterIds = encountersData.map(e => e.encounter_id);
        
        let safetyAnswers: Record<string, any[]> = {};
        
        if (encounterIds.length > 0) {
          const { data: safetyData, error: safetyError } = await supabase
            .from('encounter_safety_answers')
            .select('*')
            .in('encounter_id', encounterIds);

          if (safetyError) throw safetyError;

          if (safetyData) {
            safetyAnswers = safetyData.reduce((acc, answer) => {
              if (!acc[answer.encounter_id]) {
                acc[answer.encounter_id] = [];
              }
              acc[answer.encounter_id].push(answer);
              return acc;
            }, {} as Record<string, any[]>);
          }
        }

        // Fetch chief complaint data for encounters with chief_complaint_complete stage
        const chiefComplaintEncounterIds = encountersData
          .filter(e => e.current_stage === 'chief_complaint_complete')
          .map(e => e.encounter_id);

        let chiefComplaints: Record<string, any> = {};

        if (chiefComplaintEncounterIds.length > 0) {
          // Fetch chief complaint main data
          const { data: ccData, error: ccError } = await supabase
            .from('encounter_chief_complaint')
            .select('*')
            .in('encounter_id', chiefComplaintEncounterIds);

          if (ccError) throw ccError;

          // Fetch category selections
          const { data: ccCategories, error: ccCategoriesError } = await supabase
            .from('encounter_chief_complaint_category_selections')
            .select('*')
            .in('encounter_id', chiefComplaintEncounterIds);

          if (ccCategoriesError) throw ccCategoriesError;

          // Fetch presentations
          const { data: ccPresentations, error: ccPresentationsError } = await supabase
            .from('encounter_chief_complaint_presentations')
            .select('*')
            .in('encounter_id', chiefComplaintEncounterIds);

          if (ccPresentationsError) throw ccPresentationsError;

          // Combine chief complaint data
          if (ccData) {
            chiefComplaints = ccData.reduce((acc, cc) => {
              acc[cc.encounter_id] = {
                id: cc.id,
                encounter_id: cc.encounter_id,
                overall_text: cc.overall_text,
                created_at: cc.created_at,
                updated_at: cc.updated_at,
                category_selections: (ccCategories || []).filter(c => c.encounter_id === cc.encounter_id),
                presentations: (ccPresentations || []).filter(p => p.encounter_id === cc.encounter_id),
              };
              return acc;
            }, {} as Record<string, any>);
          }
        }

        // Combine all data
        const combinedData: EncounterData[] = encountersData.map(encounter => ({
          encounter_id: encounter.encounter_id,
          encounter_token: encounter.encounter_token,
          current_stage: encounter.current_stage as EncounterData['current_stage'],
          status: encounter.status as EncounterData['status'],
          created_at: encounter.created_at,
          patient_identity: encounter.patient_identity_id
            ? patientIdentities[encounter.patient_identity_id] || null
            : null,
          safety_answers: safetyAnswers[encounter.encounter_id] || [],
          chief_complaint: chiefComplaints[encounter.encounter_id] || null,
        }));

        setEncounters(combinedData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching encounters:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEncounters();
  }, []);

  return { encounters, loading, error };
};

