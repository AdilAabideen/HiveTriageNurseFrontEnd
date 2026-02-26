import React, { useState } from 'react';
import KanbanColumn from './KanbanColumn';
import Overlay from './Overlay';
import { EncounterData } from '../types/encounter';
import { NurseDashboardResponse } from '../types/nurse';
import { useNurseBoardData } from '../hooks/useNurseBoardData';

interface CardData {
  id: string;
  title: string;
  subtitle?: string[];
  triageTier?: number | null;
  useFullTierBorder?: boolean;
  encounter?: EncounterData;
  dashboard?: NurseDashboardResponse | null;
}

const currentStageLabels: Record<EncounterData['current_stage'], string> = {
  safety_screen: 'Safety Screening',
  intake: 'Patient Intake',
  chief_complaint: 'Chief Complaint',
  chief_complaint_complete: 'Chief Complaint Complete',
  nurse_review: 'Nurse Review',
  completed: 'Completed',
  handoff_triage: 'AI Triage in Progress',
};

const KanbanBoard: React.FC = () => {
  const [selectedEncounter, setSelectedEncounter] = useState<EncounterData | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const { encounters, dashboardsByEncounterId, loading, error } = useNurseBoardData();

  const [currentOrderCards] = useState<CardData[]>([]);

  const aiTriageOrderCards: CardData[] = [];
  const inProgressCards: CardData[] = [];
  const urgentCards: CardData[] = [];

  const resolveSuggestedTier = (dashboard: NurseDashboardResponse | null | undefined): number | null => {
    if (!dashboard) return null;
    return dashboard.final_summary?.suggested_tier
      ?? dashboard.live_state?.suggested_tier
      ?? dashboard.live_state?.current_tier
      ?? null;
  };

  const isTriageCompleted = (dashboard: NurseDashboardResponse | null | undefined): boolean => {
    if (!dashboard) return false;
    return dashboard.live_state?.status === 'completed' || Boolean(dashboard.final_summary);
  };

  encounters.forEach((encounter) => {
    const dashboard = dashboardsByEncounterId[encounter.encounter_id] ?? null;
    const suggestedTier = resolveSuggestedTier(dashboard);
    const isTriageFinishedStage = String(encounter.current_stage) === 'triage_finished';

    const subtitleParts: string[] = [
      `Current Stage : ${currentStageLabels[encounter.current_stage] || encounter.current_stage}`,
      ...(suggestedTier !== null ? [`Tier : ${suggestedTier}`] : []),
    ];

    const card: CardData = {
      id: encounter.encounter_token,
      title: encounter.patient_identity?.full_name || 'Unknown Patient',
      subtitle: subtitleParts,
      triageTier: suggestedTier,
      useFullTierBorder: isTriageFinishedStage,
      encounter,
      dashboard,
    };

    if (isTriageCompleted(dashboard)) {
      if (isTriageFinishedStage && suggestedTier !== null && suggestedTier <= 2) {
        urgentCards.push(card);
        return;
      }
      if (suggestedTier !== null && suggestedTier >= 3 && suggestedTier <= 5) {
        aiTriageOrderCards.push(card);
        return;
      }
    }

    inProgressCards.push(card);
  });

  const handleCardClick = (card: CardData) => {
    if (card.encounter) {
      setSelectedEncounter(card.encounter);
      setIsOverlayOpen(true);
    }
  };

  const handleCloseOverlay = () => {
    setIsOverlayOpen(false);
    setSelectedEncounter(null);
  };

  return (
    <div className="h-screen w-full bg-gray-50 font-hind">
      <div className="p-4">
        <div className="mb-3 text-sm text-gray-600 font-hind">
          {loading ? 'Loading encounters and triage dashboards...' : `${encounters.length} encounters loaded`}
          {error ? <span className="ml-2 text-red-600">Dashboard load warning: {error}</span> : null}
        </div>
        <div className="grid grid-cols-4 gap-3 h-[calc(100vh-48px)]">
          <KanbanColumn
            title="Current Order"
            cards={currentOrderCards}
            onCardClick={handleCardClick}
          />
          <KanbanColumn
            title="AI Triage Order"
            cards={aiTriageOrderCards}
            onCardClick={handleCardClick}
          />
          {/* <KanbanColumn
            title="Kiosk Traige Done"
            cards={kioskTriageDoneCards}
            onCardClick={handleCardClick}
          /> */}
          <KanbanColumn
            title="In Progress"
            cards={inProgressCards}
            onCardClick={handleCardClick}
          />
          <KanbanColumn
            title="Urgent"
            cards={urgentCards}
            onCardClick={handleCardClick}
          />
        </div>
      </div>

      <Overlay
        isOpen={isOverlayOpen}
        onClose={handleCloseOverlay}
        encounter={selectedEncounter}
      />
    </div>
  );
};

export default KanbanBoard;
