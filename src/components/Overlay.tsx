import React, { useState, useEffect } from 'react';
import { EncounterData, Discriminator } from '../types/encounter';
import ChiefComplaintView from './ChiefComplaintView';

interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
  encounter: EncounterData | null;
}

const Overlay: React.FC<OverlayProps> = ({ isOpen, onClose, encounter }) => {
  const [discriminatorsData, setDiscriminatorsData] = useState<Record<string, Discriminator[]>>({});
  const [loadingDiscriminators, setLoadingDiscriminators] = useState(false);

  useEffect(() => {
    if (!encounter || encounter.current_stage !== 'chief_complaint_complete' || !encounter.chief_complaint) {
      return;
    }

    const fetchDiscriminators = async () => {
      if (!encounter.chief_complaint?.presentations || encounter.chief_complaint.presentations.length === 0) {
        return;
      }

      setLoadingDiscriminators(true);
      try {
        const presentationIds = encounter.chief_complaint.presentations.map(p => p.presentation_id);
        
        // Fetch discriminators from backend API
        // The backend should use Neo4j MCP to execute:
        // MATCH (p:Presentations)-[r:ASSESS_WITH]->(d:Discriminators)
        // WHERE p.presentation_id IN $presentationIds
        // RETURN p.presentation_id, p.label, r.tier, d.*
        
        const { fetchDiscriminatorsFromAPI } = await import('../utils/discriminators');
        const result = await fetchDiscriminatorsFromAPI(presentationIds);
        
        setDiscriminatorsData(result);
      } catch (error) {
        console.error('Error fetching discriminators:', error);
      } finally {
        setLoadingDiscriminators(false);
      }
    };

    fetchDiscriminators();
  }, [encounter?.encounter_id, encounter?.current_stage]);
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[60%] bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out font-hind ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 font-hind">Encounter Details</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-hind"
            >
              ×
            </button>
          </div>
          
          {encounter && (
            <div className="space-y-6">
              {/* Encounter Information */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 font-hind">Encounter Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 font-hind">Encounter Token</label>
                    <div className="mt-1 text-gray-900 font-hind">{encounter.encounter_token}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 font-hind">Status</label>
                    <div className="mt-1 text-gray-900 font-hind capitalize">{encounter.status}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 font-hind">Current Stage</label>
                    <div className="mt-1 text-gray-900 font-hind capitalize">{encounter.current_stage.replace('_', ' ')}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 font-hind">Created At</label>
                    <div className="mt-1 text-gray-900 font-hind">
                      {new Date(encounter.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Patient Identity */}
              {encounter.patient_identity && (
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 font-hind">Patient Identity</h3>
                  <div className="grid grid-cols-2 gap-4">
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
                      <div className="mt-1 text-gray-900 font-hind capitalize">
                        {encounter.patient_identity.identity_source.replace('_', ' ')}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 font-hind">Verified</label>
                      <div className="mt-1 text-gray-900 font-hind">
                        {encounter.patient_identity.verified ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Chief Complaint View - Show when stage is chief_complaint_complete */}
              {encounter.current_stage === 'chief_complaint_complete' && encounter.chief_complaint && (
                <div className="border-t pt-6">
                  <ChiefComplaintView 
                    chiefComplaint={encounter.chief_complaint}
                    discriminatorsData={discriminatorsData}
                  />
                </div>
              )}

              {/* Safety Answers - Only show if not chief_complaint_complete or if no chief complaint */}
              {encounter.current_stage !== 'chief_complaint_complete' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 font-hind">Safety Answers</h3>
                  {encounter.safety_answers.length > 0 ? (
                    <div className="space-y-3">
                      {encounter.safety_answers.map((answer) => (
                        <div key={answer.id} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900 font-hind capitalize">
                                {answer.question_id.replace(/_/g, ' ')}
                              </div>
                              <div className="text-sm text-gray-600 mt-1 font-hind">
                                Response: <span className="font-medium capitalize">{answer.response}</span>
                              </div>
                              {answer.severity_if_positive && (
                                <div className="text-sm text-gray-600 mt-1 font-hind">
                                  Severity: {answer.severity_if_positive}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 font-hind">No safety answers recorded yet.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Overlay;

